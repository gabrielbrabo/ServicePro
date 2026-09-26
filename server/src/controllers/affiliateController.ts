import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { Affiliate, IAffiliate } from "../models/Affiliate";
import { Subscription } from "../models/Subscription";
import { AffiliateCommission } from "../models/AffiliateCommission";
import { reconcileAffiliateForSubscription } from "./subscriptionController";
import { getPlan } from "../config/plans";
import { signToken } from "../utils/token";
import { getPaymentProvider } from "../services/payments";
import { env } from "../config/env";
import crypto from "crypto";
import { legalAcceptance } from "../config/legal";
import { Establishment } from "../models/Establishment";
import { resolveReferral, setUserReferrer } from "../utils/referral";
import { validateReceivingData, onlyDigits } from "../utils/receivingData";
import {
  refreshApproval,
  openAffiliateAccount,
  settleDeferredAffiliate,
  establishmentNameOf,
} from "../utils/affiliateAccount";

// link publico de indicacao do afiliado/representante (aponta para o front)
const appUrl = (): string => env.appUrl.replace(/\/$/, "");
const refLink = (code: string): string => `${appUrl()}/?ref=${code}`;

// gera um codigo curto e unico para o link (?ref=CODE). Tenta algumas vezes
// ate achar um que ainda nao existe (colisao e rara com 8 chars).
async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = crypto.randomBytes(6).toString("base64url").slice(0, 8);
    const taken = await Affiliate.exists({ code });
    if (!taken) return code;
  }
  // fallback praticamente impossivel de colidir
  return crypto.randomBytes(9).toString("base64url").slice(0, 12);
}

// shape publico do afiliado/representante (sem chaves sensiveis)
const publicAffiliate = (a: IAffiliate) => ({
  id: a._id,
  code: a.code,
  // modelo antigo (upfront): link so apos a subconta ser aprovada.
  // modelo novo (deferred): link liberado na hora — a subconta so e aberta
  // quando o 1o indicado assina (sem custo para quem nao traz ninguem).
  link:
    a.status === "active" && (a.approved || a.accountMode === "deferred")
      ? refLink(a.code)
      : "",
  approved: a.approved,
  status: a.status,
  commissionPercent: a.commissionPercent,
  accountMode: a.accountMode || "upfront",
  // subconta de recebimento ja aberta no Asaas?
  accountOpened: !!a.asaasWalletId,
  // o Asaas recusou abrir a subconta (ex.: CEP invalido): o afiliado corrige
  // os dados no painel. So aparece enquanto a conta nao foi aberta.
  accountOpenError: a.asaasWalletId ? "" : a.accountOpenError || "",
  // e-mail da conta de recebimento no Asaas ("" = o mesmo do login)
  asaasEmail: a.asaasEmail || "",
});

// refreshApproval / ensureSubaccount ficam em utils/affiliateAccount (usados
// tambem pela assinatura do estabelecimento e pelo job de repasse).

// POST /api/affiliates/register  (PUBLICO — optionalProtect)
// Cadastro aberto do afiliado/representante. Cria (ou reusa, se ja logado) a
// conta User, abre a subconta Asaas, gera o code e devolve o link de indicacao.
// body: { name, email, password, phone, cpfCnpj, birthDate, postalCode,
//         address, addressNumber, province, incomeValue? }
export const registerAffiliate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      email,
      password,
      phone,
      cpfCnpj,
      birthDate,
      postalCode,
      address,
      addressNumber,
      province,
      incomeValue,
      acceptTerms,
    } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      cpfCnpj?: string;
      birthDate?: string;
      postalCode?: string;
      address?: string;
      addressNumber?: string;
      province?: string;
      incomeValue?: number;
      acceptTerms?: boolean;
    };

    if (!cpfCnpj || !phone) {
      res
        .status(400)
        .json({ message: "CPF/CNPJ e telefone sao obrigatorios" });
      return;
    }

    // CNPJ (14 digitos) -> pessoa juridica; senao pessoa fisica (exige nascimento)
    const digits = cpfCnpj.replace(/\D/g, "");
    const isCnpj = digits.length > 11;

    // O Asaas exige esses dados para abrir a conta de recebimento. Validamos
    // aqui para devolver uma mensagem clara (em vez do erro cru do gateway).
    if (!isCnpj && !birthDate) {
      res.status(400).json({ message: "Informe sua data de nascimento." });
      return;
    }
    if (!postalCode || !address || !addressNumber || !province) {
      res.status(400).json({
        message:
          "Preencha o endereco completo (CEP, endereco, numero e bairro).",
      });
      return;
    }
    // valida CPF/CNPJ, telefone, idade e CEP JA no cadastro: a subconta so e
    // aberta no 1o indicado pagante e o erro nao pode aparecer so la
    const invalid = await validateReceivingData({
      cpfCnpj,
      phone,
      birthDate,
      postalCode,
      address,
      addressNumber,
      province,
    });
    if (invalid) {
      res.status(400).json({ message: invalid });
      return;
    }

    // 1) resolve o usuario dono da conta de afiliado. A conta de afiliado SEMPRE
    // se junta a uma conta User: um dono/funcionario/cliente pode virar afiliado
    // com o MESMO e-mail (a conta acumula os papeis).
    let user = req.userId ? await User.findById(req.userId) : null;
    if (!user) {
      if (!email || !password) {
        res.status(400).json({ message: "E-mail e senha sao obrigatorios" });
        return;
      }
      // ja existe conta com esse e-mail? vincula o afiliado a ela, exigindo a
      // senha CORRETA dessa conta (prova que e o dono do e-mail).
      const existing = await User.findOne({ email }).select("+password");
      if (existing) {
        const ok = await existing.comparePassword(password);
        if (!ok) {
          res.status(401).json({
            message:
              "Este e-mail ja tem conta. Informe a senha atual dela para virar afiliado.",
          });
          return;
        }
        user = existing;
      } else {
        // e-mail novo: cria a conta (precisa do nome)
        if (!name) {
          res.status(400).json({ message: "Informe seu nome" });
          return;
        }
        user = await User.create({
          name,
          email,
          password,
          phone,
          country: "Brasil",
        });
      }
    }

    // aceite dos Termos/Politica (LGPD) marcado no formulario do afiliado
    if (acceptTerms === true) {
      await User.updateOne({ _id: user._id }, { $set: legalAcceptance(req) });
    }

    // 2) ja e afiliado? devolve o que existe (idempotente)
    const already = await Affiliate.findOne({ user: user._id });
    if (already) {
      const token = signToken(user._id.toString());
      res.json({ token, affiliate: publicAffiliate(already) });
      return;
    }

    // 3) cria a conta de afiliado/representante SEM abrir a subconta Asaas
    // (modelo deferred): o Asaas cobra por subconta, entao ela so e aberta
    // quando o 1o indicado assinar (utils/affiliateAccount). Os dados abaixo
    // ficam guardados para essa abertura.
    const code = await generateUniqueCode();
    const affiliate = await Affiliate.create({
      user: user._id,
      code,
      status: "active",
      accountMode: "deferred",
      cpfCnpj,
      phone,
      birthDate: birthDate || "",
      postalCode: postalCode || "",
      address: address || "",
      addressNumber: addressNumber || "",
      province: province || "",
    });

    const token = signToken(user._id.toString());
    res.status(201).json({ token, affiliate: publicAffiliate(affiliate) });
  } catch (err) {
    console.error("registerAffiliate:", err);
    res.status(500).json({ message: "Erro ao cadastrar afiliado" });
  }
};

// POST /api/affiliates/login  (PUBLICO)
// Login da area do afiliado/representante: autentica no mesmo User e confirma
// que a conta tem cadastro de afiliado. body: { email, password }
export const loginAffiliate = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };
    if (!email || !password) {
      res.status(400).json({ message: "E-mail e senha sao obrigatorios" });
      return;
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      res.status(401).json({ message: "Credenciais invalidas" });
      return;
    }
    // conta criada com Google nao tem senha: orienta a usar o Google
    if (user.authProvider === "google" || !user.password) {
      res.status(409).json({
        message:
          'Esta conta foi criada com o Google. Entre com o Google no login do ServiçosPro e depois acesse a area do afiliado.',
        useGoogle: true,
      });
      return;
    }
    if (!(await user.comparePassword(password))) {
      res.status(401).json({ message: "Credenciais invalidas" });
      return;
    }

    const affiliate = await Affiliate.findOne({ user: user._id }).select(
      "+asaasApiKey"
    );
    if (!affiliate) {
      // credenciais certas, mas a conta ainda nao virou afiliado. O front usa
      // notAffiliate para oferecer o cadastro de afiliado.
      res.status(403).json({
        message:
          "Esta conta ainda nao e afiliado/representante. Cadastre-se para ativar.",
        notAffiliate: true,
      });
      return;
    }
    await refreshApproval(affiliate);

    const token = signToken(user._id.toString());
    res.json({ token, affiliate: publicAffiliate(affiliate) });
  } catch (err) {
    console.error("loginAffiliate:", err);
    res.status(500).json({ message: "Erro ao entrar" });
  }
};

// GET /api/affiliates/me  (protegido)
// Dados da conta de afiliado do usuario logado (para o painel decidir o acesso).
export const getMyAffiliate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.userId }).select(
      "+asaasApiKey"
    );
    if (!affiliate) {
      res.status(404).json({ message: "Voce ainda nao e afiliado" });
      return;
    }
    await refreshApproval(affiliate);
    // deferred aprovado: aplica splits pendentes e repassa comissoes guardadas
    if (affiliate.accountMode === "deferred") {
      void settleDeferredAffiliate(affiliate._id);
    }
    res.json({ affiliate: publicAffiliate(affiliate) });
  } catch (err) {
    console.error("getMyAffiliate:", err);
    res.status(500).json({ message: "Erro ao carregar afiliado" });
  }
};

// comissao mensal-equivalente de uma assinatura (para o resumo). Anual = valor
// do ano / 12; mensal = o proprio valor. Depois aplica a porcentagem.
function monthlyCommissionCents(
  priceCents: number,
  billingCycle: string,
  percent: number
): number {
  const monthlyBase =
    billingCycle === "anual" ? priceCents / 12 : priceCents;
  return Math.round((monthlyBase * percent) / 100);
}

// GET /api/affiliates/me/referrals  (protegido)
// Lista os indicados do afiliado (assinaturas com este afiliado) + um resumo.
// Enquanto o ledger (fase 4) nao existe, os valores sao PREVISTOS a partir da
// assinatura (25% do plano), nao "recebidos".
export const getMyReferrals = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.userId }).select(
      "+asaasApiKey"
    );
    if (!affiliate) {
      res.status(404).json({ message: "Voce ainda nao e afiliado" });
      return;
    }
    await refreshApproval(affiliate);
    if (affiliate.accountMode === "deferred") {
      void settleDeferredAffiliate(affiliate._id);
    }
    const percent = affiliate.commissionPercent || 25;

    const subs = await Subscription.find({ affiliate: affiliate._id })
      .populate("establishment", "name photo")
      .sort({ createdAt: -1 })
      .lean();

    // rede de seguranca: reconcilia comissoes direto na API do gateway (caso o
    // webhook nao tenha chegado). Idempotente por paymentId. Limita a chamada.
    for (const s of subs.slice(0, 30)) {
      const est = s.establishment as unknown as { _id?: unknown } | null;
      await reconcileAffiliateForSubscription({
        _id: s._id,
        affiliate: affiliate._id,
        providerSubscriptionId: s.providerSubscriptionId,
        establishment: est?._id ? String(est._id) : null,
        planId: s.planId,
        // define se a comissao ja veio no split ou fica "a repassar"
        affiliateWalletId: s.affiliateWalletId || "",
      });
    }

    const referrals = subs.map((s) => {
      const est = s.establishment as unknown as {
        _id?: unknown;
        name?: string;
        photo?: string;
      } | null;
      const plan = getPlan(s.planId);
      const commissionCents = Math.round((s.priceCents * percent) / 100);
      return {
        subscriptionId: String(s._id),
        establishmentId: est?._id ? String(est._id) : "",
        establishmentName: est?.name || "Estabelecimento",
        establishmentPhoto: est?.photo || null,
        planId: s.planId,
        planName: plan?.name || s.planId,
        billingCycle: s.billingCycle,
        priceCents: s.priceCents,
        status: s.status,
        commissionPercent: percent,
        commissionCents,
        currentPeriodEnd: s.currentPeriodEnd || null,
      };
    });

    const activeRefs = referrals.filter(
      (r) => r.status === "active" || r.status === "trialing"
    );

    // recebido de verdade (ledger): total acumulado e o do mes corrente.
    // Ignora comissoes revertidas (estorno/chargeback) para nao inflar.
    const allCommissions = await AffiliateCommission.find({
      affiliate: affiliate._id,
      reversed: { $ne: true },
    })
      .select("commissionCents paidAt payout")
      .lean();
    // "recebido" = ja caiu na conta (split ou repasse). "a repassar" = entrou
    // antes da conta do afiliado ser aprovada (sera transferido).
    const isPendingPayout = (c: { payout?: string }) =>
      c.payout === "pending" || c.payout === "transferring";
    const commissions = allCommissions.filter((c) => !isPendingPayout(c));
    const pendingPayoutCents = allCommissions
      .filter(isPendingPayout)
      .reduce((acc, c) => acc + (c.commissionCents || 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const receivedTotalCents = commissions.reduce(
      (acc, c) => acc + (c.commissionCents || 0),
      0
    );
    const receivedMonthCents = commissions.reduce(
      (acc, c) =>
        c.paidAt && new Date(c.paidAt) >= monthStart
          ? acc + (c.commissionCents || 0)
          : acc,
      0
    );

    const summary = {
      total: referrals.length,
      active: activeRefs.length,
      commissionPercent: percent,
      // comissao prevista por mes (soma dos ativos, anual normalizado /12)
      monthlyEstimateCents: activeRefs.reduce(
        (acc, r) =>
          acc + monthlyCommissionCents(r.priceCents, r.billingCycle, percent),
        0
      ),
      // comissao prevista por cobranca (soma dos ativos, no ciclo de cada um)
      perPaymentEstimateCents: activeRefs.reduce(
        (acc, r) => acc + r.commissionCents,
        0
      ),
      // recebido de verdade (a partir do ledger de comissoes confirmadas)
      receivedTotalCents,
      receivedMonthCents,
      // comissoes guardadas ate a conta de recebimento ser aprovada
      pendingPayoutCents,
    };

    // a reconciliacao acima pode ter ABERTO a subconta agora: recarrega para o
    // painel ja mostrar o estado novo
    const fresh = (await Affiliate.findById(affiliate._id)) || affiliate;
    res.json({ affiliate: publicAffiliate(fresh), summary, referrals });
  } catch (err) {
    console.error("getMyReferrals:", err);
    res.status(500).json({ message: "Erro ao carregar indicados" });
  }
};

// saques gratuitos por mes (informativo no painel). Configuravel por env;
// 0/ausente = nao afirmamos um numero (as condicoes do Asaas mudam).
const FREE_WITHDRAWALS_PER_MONTH =
  Number(process.env.AFFILIATE_FREE_WITHDRAWALS_PER_MONTH) || 0;

// painel web do Asaas (onde o afiliado saca). Sandbox x producao pela baseUrl.
const asaasWebBase = env.payments.asaas.baseUrl.includes("sandbox")
  ? "https://sandbox.asaas.com"
  : "https://www.asaas.com";

// GET /api/affiliates/me/wallet  (protegido)
// Saldo da subconta Asaas do afiliado + link para ele SACAR DENTRO do Asaas.
// Modelo escolhido: o saque acontece no proprio Asaas (conta do afiliado); o
// app so mostra o saldo e redireciona para la.
export const getMyWallet = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.userId }).select(
      "+asaasApiKey"
    );
    if (!affiliate) {
      res.status(404).json({ message: "Voce ainda nao e afiliado" });
      return;
    }
    const provider = getPaymentProvider();
    let balanceCents = 0;
    let balanceAvailable = false;
    if (affiliate.asaasApiKey && provider.getBalance) {
      try {
        const b = await provider.getBalance(affiliate.asaasApiKey);
        balanceCents = b.balanceCents;
        balanceAvailable = true;
      } catch (e) {
        // conta ainda em ativacao ou sem saldo: nao quebra o painel
        console.error("getBalance:", (e as Error).message);
      }
    }
    res.json({
      balanceCents,
      balanceAvailable,
      // a subconta existe (tem carteira)? conseguimos ler o saldo (tem apiKey)?
      hasAccount: !!affiliate.asaasWalletId,
      canReadBalance: !!affiliate.asaasApiKey,
      accountMode: affiliate.accountMode || "upfront",
      approved: affiliate.approved,
      asaasLoginUrl: `${asaasWebBase}/login`,
      freeWithdrawalsPerMonth: FREE_WITHDRAWALS_PER_MONTH || null,
    });
  } catch (err) {
    console.error("getMyWallet:", err);
    res.status(500).json({ message: "Erro ao consultar o saldo" });
  }
};

// GET /api/affiliates/my-referrer  (qualquer usuario logado)
// Diz se o dono logado JA foi indicado por um afiliado/representante e, se sim,
// o nome dele. O cadastro de estabelecimento usa isto para travar o campo de
// link de indicacao (nao da pra trocar de afiliado depois de indicado).
export const getMyReferrer = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select("referredByAffiliate");
    if (!user?.referredByAffiliate) {
      res.json({ referred: false });
      return;
    }
    const aff = await Affiliate.findById(user.referredByAffiliate)
      .populate("user", "name")
      .lean();
    if (!aff) {
      res.json({ referred: false });
      return;
    }
    const affName =
      (aff.user as unknown as { name?: string } | null)?.name || "Afiliado";
    res.json({ referred: true, affiliateName: affName, code: aff.code });
  } catch (err) {
    console.error("getMyReferrer:", err);
    res.status(500).json({ message: "Erro ao verificar indicacao" });
  }
};

// GET /api/affiliates/check-ref?ref=<link ou codigo>  (protegido)
// Confere o link de indicacao antes do cadastro do estabelecimento: o front
// mostra o nome do afiliado e bloqueia link invalido.
export const checkReferral = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const r = await resolveReferral(req.query.ref, String(req.userId));
    if (!r.ok) {
      res.status(400).json({ valid: false, message: r.message });
      return;
    }
    res.json({ valid: true, affiliateName: r.affiliateName, code: r.code });
  } catch (err) {
    console.error("checkReferral:", err);
    res.status(500).json({ message: "Erro ao verificar o link" });
  }
};

// POST /api/affiliates/my-referrer  (protegido)  body: { ref }
// O dono informa DEPOIS do cadastro quem o indicou. Vale uma unica vez (quem ja
// tem indicacao nao troca). Vincula as assinaturas dos estabelecimentos dele
// que ainda nao tem afiliado e aplica o split nas PROXIMAS cobrancas.
export const linkMyReferrer = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.userId);
    const user = await User.findById(userId).select("referredByAffiliate");
    if (!user) {
      res.status(404).json({ message: "Usuario nao encontrado" });
      return;
    }
    if (user.referredByAffiliate) {
      res.status(409).json({
        message: "Sua conta já está vinculada a um afiliado/representante.",
      });
      return;
    }

    const r = await resolveReferral(req.body?.ref, userId);
    if (!r.ok) {
      res.status(400).json({ message: r.message });
      return;
    }

    const linked = await setUserReferrer(userId, r.affiliateId);
    if (!linked) {
      res.status(409).json({
        message: "Sua conta já está vinculada a um afiliado/representante.",
      });
      return;
    }

    // assinaturas dos estabelecimentos do dono ainda sem afiliado
    const ests = await Establishment.find({ owner: userId }).select("_id");
    const subs = await Subscription.find({
      establishment: { $in: ests.map((e) => e._id) },
      $or: [{ affiliate: null }, { affiliate: { $exists: false } }],
    });

    const provider = getPaymentProvider();
    // afiliado do modelo novo ainda sem subconta: abre agora se ja ha um
    // indicado pagante (so entao o Asaas cobra pela subconta)
    let walletId = r.walletId;
    // so abre com indicado PAGANTE (status active = ja pagou)
    const hasPaying = subs.some(
      (x) => x.providerSubscriptionId && x.status === "active"
    );
    if (!walletId && hasPaying) {
      const firstEst = subs.find((x) => x.status === "active")?.establishment;
      walletId = await openAffiliateAccount(r.affiliateId, {
        establishmentName: await establishmentNameOf(firstEst),
      });
    }
    let splitsApplied = 0;
    for (const sub of subs) {
      sub.affiliate = r.affiliateId;
      // dinheiro so flui se o afiliado tem carteira e a assinatura esta ativa
      // no gateway; senao fica so a atribuicao (aparece no painel dele)
      if (
        walletId &&
        sub.providerSubscriptionId &&
        sub.status !== "canceled" &&
        provider.updateSubscriptionSplit
      ) {
        try {
          const commissionCents = Math.round((sub.priceCents * r.percent) / 100);
          await provider.updateSubscriptionSplit(
            sub.providerSubscriptionId,
            walletId,
            commissionCents
          );
          sub.affiliateWalletId = walletId;
          splitsApplied++;
        } catch (e) {
          console.error(
            `linkMyReferrer: split nao aplicado na assinatura ${sub._id}:`,
            (e as Error).message
          );
        }
      }
      await sub.save();
    }

    res.json({
      referred: true,
      affiliateName: r.affiliateName,
      code: r.code,
      subscriptionsLinked: subs.length,
      splitsApplied,
    });
  } catch (err) {
    console.error("linkMyReferrer:", err);
    res.status(500).json({ message: "Erro ao vincular a indicacao" });
  }
};

// GET /api/affiliates/me/receiving-data  (protegido)
// Dados da conta de recebimento (para corrigir quando o Asaas recusou abrir).
export const getMyReceivingData = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const a = await Affiliate.findOne({ user: req.userId }).select("+cpfCnpj");
    if (!a) {
      res.status(404).json({ message: "Voce ainda nao e afiliado" });
      return;
    }
    res.json({
      cpfCnpj: a.cpfCnpj,
      phone: a.phone,
      birthDate: a.birthDate,
      postalCode: a.postalCode,
      address: a.address,
      addressNumber: a.addressNumber,
      province: a.province,
      // e-mail da conta de recebimento ("" = o mesmo do login)
      asaasEmail: a.asaasEmail || "",
      editable: !a.asaasWalletId,
      accountOpenError: a.asaasWalletId ? "" : a.accountOpenError || "",
    });
  } catch (err) {
    console.error("getMyReceivingData:", err);
    res.status(500).json({ message: "Erro ao carregar os dados" });
  }
};

// PUT /api/affiliates/me/receiving-data  (protegido)
// Corrige os dados ANTES de a subconta existir e, se ja ha indicado pagante,
// tenta abrir a conta na hora. Depois de aberta, os dados sao do Asaas.
export const updateMyReceivingData = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const a = await Affiliate.findOne({ user: req.userId }).select("+cpfCnpj");
    if (!a) {
      res.status(404).json({ message: "Voce ainda nao e afiliado" });
      return;
    }
    if (a.asaasWalletId) {
      res.status(409).json({
        message:
          "Sua conta de recebimento já foi aberta. Altere os dados direto no Asaas.",
      });
      return;
    }
    const b = (req.body || {}) as Record<string, string | undefined>;
    const data = {
      cpfCnpj: onlyDigits(b.cpfCnpj),
      phone: String(b.phone || "").trim(),
      birthDate: String(b.birthDate || "").trim(),
      postalCode: onlyDigits(b.postalCode),
      address: String(b.address || "").trim(),
      addressNumber: String(b.addressNumber || "").trim(),
      province: String(b.province || "").trim(),
    };
    const invalid = await validateReceivingData(data);
    if (invalid) {
      res.status(400).json({ message: invalid });
      return;
    }
    // e-mail opcional para a conta de recebimento (o Asaas exige e-mail unico;
    // quem ja tem conta Asaas com o e-mail do login informa outro)
    const asaasEmail = String(b.asaasEmail || "").trim().toLowerCase();
    if (asaasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asaasEmail)) {
      res.status(400).json({ message: "E-mail da conta de recebimento inválido." });
      return;
    }
    Object.assign(a, data, { accountOpenError: "", asaasEmail });
    await a.save();

    // ja tem indicado pagante? abre a conta agora
    let opened = false;
    let error = "";
    const paying = await Subscription.findOne({
      affiliate: a._id,
      status: "active",
    }).select("establishment");
    if (paying) {
      const wallet = await openAffiliateAccount(a._id, {
        establishmentName: await establishmentNameOf(paying.establishment),
      });
      opened = !!wallet;
      if (!opened) {
        const again = await Affiliate.findById(a._id).select("accountOpenError");
        error = again?.accountOpenError || "";
      }
    }
    res.json({ saved: true, opened, accountOpenError: error });
  } catch (err) {
    console.error("updateMyReceivingData:", err);
    res.status(500).json({ message: "Erro ao salvar os dados" });
  }
};
