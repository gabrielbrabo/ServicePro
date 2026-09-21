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
  link: refLink(a.code),
  status: a.status,
  commissionPercent: a.commissionPercent,
});

// cria (ou reusa) a subconta Asaas do afiliado. Com o adapter noop (dev) devolve
// uma carteira ficticia; nada quebra. findSubaccount evita duplicar quando o
// CPF/CNPJ ja tem conta no Asaas.
async function ensureSubaccount(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  birthDate?: string;
}): Promise<{ accountId: string; walletId: string; apiKey: string }> {
  const provider = getPaymentProvider();
  let accountId = "";
  let walletId = "";
  let apiKey = "";

  if (provider.findSubaccount && input.cpfCnpj) {
    const found = await provider.findSubaccount(input.cpfCnpj);
    if (found) {
      accountId = found.accountId;
      walletId = found.walletId;
    }
  }
  if (!walletId && provider.createSubaccount) {
    const created = await provider.createSubaccount({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      mobilePhone: input.phone,
      incomeValue: input.incomeValue,
      address: input.address,
      addressNumber: input.addressNumber,
      province: input.province,
      postalCode: input.postalCode,
      birthDate: input.birthDate,
    });
    accountId = created.accountId;
    walletId = created.walletId;
    apiKey = created.apiKey;
  }
  return { accountId, walletId, apiKey };
}

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
    };

    if (!cpfCnpj || !phone) {
      res
        .status(400)
        .json({ message: "CPF/CNPJ e telefone sao obrigatorios" });
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

    // 2) ja e afiliado? devolve o que existe (idempotente)
    const already = await Affiliate.findOne({ user: user._id });
    if (already) {
      const token = signToken(user._id.toString());
      res.json({ token, affiliate: publicAffiliate(already) });
      return;
    }

    // 3) abre a subconta Asaas (recebe o split de comissao)
    const sub = await ensureSubaccount({
      name: user.name,
      email: user.email,
      cpfCnpj,
      phone,
      incomeValue: Number(incomeValue) > 0 ? Number(incomeValue) : 1000,
      address: address || "",
      addressNumber: addressNumber || "",
      province: province || "",
      postalCode: postalCode || "",
      birthDate,
    });

    // 4) cria a conta de afiliado/representante
    const code = await generateUniqueCode();
    const affiliate = await Affiliate.create({
      user: user._id,
      code,
      status: "active",
      asaasAccountId: sub.accountId,
      asaasWalletId: sub.walletId,
      asaasApiKey: sub.apiKey,
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
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: "Credenciais invalidas" });
      return;
    }

    const affiliate = await Affiliate.findOne({ user: user._id });
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
    const affiliate = await Affiliate.findOne({ user: req.userId });
    if (!affiliate) {
      res.status(404).json({ message: "Voce ainda nao e afiliado" });
      return;
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
    const affiliate = await Affiliate.findOne({ user: req.userId });
    if (!affiliate) {
      res.status(404).json({ message: "Voce ainda nao e afiliado" });
      return;
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
    const commissions = await AffiliateCommission.find({
      affiliate: affiliate._id,
      reversed: { $ne: true },
    })
      .select("commissionCents paidAt")
      .lean();
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
    };

    res.json({ affiliate: publicAffiliate(affiliate), summary, referrals });
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
      asaasLoginUrl: `${asaasWebBase}/login`,
      freeWithdrawalsPerMonth: FREE_WITHDRAWALS_PER_MONTH || null,
    });
  } catch (err) {
    console.error("getMyWallet:", err);
    res.status(500).json({ message: "Erro ao consultar o saldo" });
  }
};
