import { env } from "../config/env";
import { Affiliate, IAffiliate } from "../models/Affiliate";
import {
  AffiliateCommission,
  CommissionPayout,
} from "../models/AffiliateCommission";
import { Subscription } from "../models/Subscription";
import { User } from "../models/User";
import { Establishment } from "../models/Establishment";
import { getPaymentProvider } from "../services/payments";
import {
  sendAffiliateAccountOpenedEmail,
  sendAffiliatePayoutEmail,
  sendAffiliateAccountDataEmail,
} from "./affiliateEmails";
import crypto from "crypto";

// Conta de recebimento (subconta Asaas) do afiliado/representante.
//
// Modelo "deferred" (cadastros novos): a subconta NAO e aberta no cadastro (o
// Asaas cobra por subconta). Ela e aberta quando o 1o pagamento de um indicado
// CONFIRMA (so existe custo quando entra dinheiro):
//   1. a assinatura do indicado sai sem split, so com a atribuicao;
//   2. no 1o pagamento confirmado, openAffiliateAccount() cria a subconta com
//      os dados do cadastro; o pagamento entrou inteiro na conta principal e a
//      comissao fica "pending" no ledger;
//   3. enquanto a subconta nao e aprovada, as proximas comissoes tambem ficam
//      "pending";
//   4. settleDeferredAffiliate() (job + painel + webhook), quando a subconta e
//      aprovada: aplica o split nas assinaturas sem split e TRANSFERE o que
//      ficou pendente. Nenhuma comissao se perde.
// Afiliados antigos ("upfront") ja tem subconta e seguem como antes.

// Consulta o status da conta Asaas do afiliado e marca approved=true quando
// aprovada. Retorna o afiliado (atualizado). Falha silenciosa. Precisa da
// asaasApiKey (subconta) selecionada no doc.
// SO PARA TESTE: no sandbox nao da para aprovar uma subconta sem documentos
// reais. Com AFFILIATE_SANDBOX_AUTO_APPROVE=true no .env E o Asaas apontando
// para o sandbox, a subconta aberta e tratada como aprovada. Em producao
// (baseUrl sem "sandbox") isto NUNCA vale, mesmo com a variavel ligada.
const sandboxAutoApprove = (): boolean =>
  process.env.AFFILIATE_SANDBOX_AUTO_APPROVE === "true" &&
  env.payments.asaas.baseUrl.includes("sandbox");

export async function refreshApproval(a: IAffiliate): Promise<IAffiliate> {
  try {
    if (a.approved) return a;
    if (a.asaasWalletId && sandboxAutoApprove()) {
      a.approved = true;
      a.approvedAt = new Date();
      await a.save();
      console.log(`[sandbox] afiliado ${a._id} aprovado automaticamente (teste)`);
      return a;
    }
    if (!a.asaasApiKey) return a;
    const provider = getPaymentProvider();
    if (!provider.getSubaccountStatus) return a;
    const st = await provider.getSubaccountStatus(a.asaasApiKey);
    if (st.approved) {
      a.approved = true;
      a.approvedAt = new Date();
      await a.save();
    }
  } catch (e) {
    console.error("refreshApproval:", (e as Error).message);
  }
  return a;
}

// cria (ou reusa) a subconta Asaas do afiliado. Com o adapter noop (dev) devolve
// uma carteira ficticia; nada quebra. findSubaccount evita duplicar quando o
// CPF/CNPJ ja tem conta no Asaas.
export async function ensureSubaccount(input: {
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
  companyType?: string;
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
      // O Asaas so devolve a apiKey da subconta na CRIACAO. Se ela ja foi
      // criada antes por este sistema (outro cadastro de afiliado no mesmo
      // banco), reaproveita a chave guardada para conseguir checar a aprovacao.
      const prev = await Affiliate.findOne({
        $or: [{ asaasAccountId: accountId }, { asaasWalletId: walletId }],
        asaasApiKey: { $nin: [null, ""] },
      }).select("+asaasApiKey");
      if (prev?.asaasApiKey) {
        apiKey = prev.asaasApiKey;
      } else {
        console.warn(
          `ensureSubaccount: subconta Asaas ${accountId} reaproveitada SEM apiKey — ` +
            "a aprovacao nao pode ser checada automaticamente; aprove o afiliado " +
            "manualmente (approved=true) apos conferir a subconta no Asaas."
        );
      }
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
      // pessoa fisica exige birthDate; pessoa juridica exige companyType
      birthDate: input.companyType ? undefined : input.birthDate,
      companyType: input.companyType,
    });
    accountId = created.accountId;
    walletId = created.walletId;
    apiKey = created.apiKey;
  }
  return { accountId, walletId, apiKey };
}


// Abre a subconta do afiliado (modelo deferred) se ainda nao existir e devolve
// o walletId ("" se nao deu). Nunca lanca: quem chama segue sem split.
export async function openAffiliateAccount(
  affiliateId: unknown,
  ctx: { establishmentName?: string } = {}
): Promise<string> {
  try {
    const current = await Affiliate.findById(affiliateId).select(
      "asaasWalletId status"
    );
    if (!current || current.status !== "active") return "";
    if (current.asaasWalletId) return current.asaasWalletId;

    // trava: so UMA requisicao abre a conta (duas assinaturas ao mesmo tempo
    // nao podem criar duas subcontas). Trava vencida (2 min) e liberada.
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
    const aff = await Affiliate.findOneAndUpdate(
      {
        _id: current._id,
        asaasWalletId: "",
        $or: [
          { accountOpeningAt: null },
          { accountOpeningAt: { $lt: staleBefore } },
        ],
      },
      { $set: { accountOpeningAt: new Date() } },
      { new: true }
    ).select("+asaasApiKey +cpfCnpj");

    if (!aff) {
      // outra requisicao esta abrindo: espera um pouco e usa o resultado dela
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const again = await Affiliate.findById(current._id).select(
          "asaasWalletId"
        );
        if (again?.asaasWalletId) return again.asaasWalletId;
      }
      return "";
    }

    try {
      const user = await User.findById(aff.user).select("name email");
      const digits = (aff.cpfCnpj || "").replace(/\D/g, "");
      const isCnpj = digits.length > 11;
      const sub = await ensureSubaccount({
        name: user?.name || "Afiliado",
        email: user?.email || "",
        cpfCnpj: aff.cpfCnpj,
        phone: aff.phone,
        incomeValue: 1000,
        address: aff.address,
        addressNumber: aff.addressNumber,
        province: aff.province,
        postalCode: aff.postalCode,
        birthDate: aff.birthDate || undefined,
        companyType: isCnpj ? "LIMITED" : undefined,
      });
      if (!sub.walletId) throw new Error("subconta sem walletId");

      aff.asaasAccountId = sub.accountId;
      aff.asaasWalletId = sub.walletId;
      if (sub.apiKey) aff.asaasApiKey = sub.apiKey;
      aff.accountOpenedAt = new Date();
      aff.accountOpeningAt = null;
      aff.accountOpenError = "";
      await aff.save();
      console.log(
        `[affiliate-account] subconta aberta afiliado=${aff._id} wallet=${sub.walletId}`
      );

      if (user?.email) {
        sendAffiliateAccountOpenedEmail({
          to: user.email,
          establishmentName: ctx.establishmentName || "Um estabelecimento",
        });
      }
      return sub.walletId;
    } catch (e) {
      const msg = (e as Error).message || "erro";
      console.error(`openAffiliateAccount ${aff._id}:`, msg);
      const changed = aff.accountOpenError !== msg.slice(0, 300);
      aff.accountOpeningAt = null;
      aff.accountOpenError = msg.slice(0, 300);
      await aff.save();
      // avisa o afiliado para corrigir os dados no painel (so quando o erro
      // muda, para nao mandar o mesmo e-mail a cada tentativa)
      if (changed) {
        const u = await User.findById(aff.user).select("email");
        if (u?.email) {
          sendAffiliateAccountDataEmail({ to: u.email, reason: msg });
        }
      }
      return "";
    }
  } catch (e) {
    console.error("openAffiliateAccount:", (e as Error).message);
    return "";
  }
}

// Como a comissao de um pagamento chega ao afiliado: se a assinatura tem split
// aplicado, o Asaas ja repassou; senao (afiliado deferred sem split) fica
// pendente para transferir depois.
export function commissionPayoutFor(
  aff: Pick<IAffiliate, "accountMode">,
  sub: { affiliateWalletId?: string | null }
): CommissionPayout {
  return aff.accountMode === "deferred" && !sub.affiliateWalletId
    ? "pending"
    : "split";
}

// Quando a subconta do afiliado (deferred) esta aprovada: aplica o split nas
// assinaturas dos indicados que ainda estao sem split e transfere as comissoes
// pendentes. Idempotente e seguro para rodar varias vezes. Nunca lanca.
export async function settleDeferredAffiliate(affiliateId: unknown): Promise<void> {
  try {
    const aff = await Affiliate.findById(affiliateId).select("+asaasApiKey");
    if (!aff || aff.accountMode !== "deferred") return;
    if (aff.status !== "active" || !aff.asaasWalletId) return;

    await refreshApproval(aff);
    if (!aff.approved) return;

    const provider = getPaymentProvider();
    const wallet = aff.asaasWalletId;
    const percent = aff.commissionPercent || 25;

    // 1) split nas assinaturas ativas que ficaram sem (proximas cobrancas ja
    //    caem direto na conta do afiliado)
    if (provider.updateSubscriptionSplit) {
      const subs = await Subscription.find({
        affiliate: aff._id,
        status: { $ne: "canceled" },
        providerSubscriptionId: { $nin: [null, ""] },
        $or: [{ affiliateWalletId: "" }, { affiliateWalletId: null }],
      });
      for (const sub of subs) {
        // anti-autoindicacao
        if (sub.owner && String(sub.owner) === String(aff.user)) continue;
        try {
          const commissionCents = Math.round((sub.priceCents * percent) / 100);
          await provider.updateSubscriptionSplit(
            sub.providerSubscriptionId,
            wallet,
            commissionCents
          );
          sub.affiliateWalletId = wallet;
          await sub.save();
        } catch (e) {
          console.error(
            `settleDeferredAffiliate: split nao aplicado em ${sub._id}:`,
            (e as Error).message
          );
        }
      }
    }

    // 2) repasse das comissoes que entraram sem split
    if (!provider.transferToWallet) return;
    const pending = await AffiliateCommission.find({
      affiliate: aff._id,
      payout: "pending",
      reversed: { $ne: true },
    }).select("_id");
    if (!pending.length) return;

    // marca o lote (trava contra repasse em dobro se rodar em paralelo)
    const batch = `aff-${aff._id}-${crypto.randomBytes(6).toString("hex")}`;
    await AffiliateCommission.updateMany(
      { _id: { $in: pending.map((c) => c._id) }, payout: "pending" },
      { $set: { payout: "transferring", transferId: batch } }
    );
    const lot = await AffiliateCommission.find({ transferId: batch }).select(
      "commissionCents"
    );
    const total = lot.reduce((acc, c) => acc + (c.commissionCents || 0), 0);
    if (total <= 0) {
      await AffiliateCommission.updateMany(
        { transferId: batch },
        { $set: { payout: "transferred", transferredAt: new Date() } }
      );
      return;
    }

    try {
      const t = await provider.transferToWallet({
        walletId: wallet,
        valueCents: total,
        externalRef: batch,
      });
      await AffiliateCommission.updateMany(
        { transferId: batch },
        {
          $set: {
            payout: "transferred",
            transferId: t.transferId || batch,
            transferredAt: new Date(),
          },
        }
      );
      console.log(
        `[affiliate-payout] afiliado=${aff._id} valor=${total} transfer=${t.transferId}`
      );
      const user = await User.findById(aff.user).select("email");
      if (user?.email) {
        sendAffiliatePayoutEmail({ to: user.email, valueCents: total });
      }
    } catch (e) {
      // volta para pendente: tenta de novo na proxima rodada
      await AffiliateCommission.updateMany(
        { transferId: batch },
        { $set: { payout: "pending", transferId: "" } }
      );
      console.error(
        `settleDeferredAffiliate: transferencia falhou (afiliado ${aff._id}):`,
        (e as Error).message
      );
    }
  } catch (e) {
    console.error("settleDeferredAffiliate:", (e as Error).message);
  }
}

// Roda o acerto para todos os afiliados deferred (job):
//  - abertura da subconta que falhou antes (ja tem indicado pagante);
//  - split + repasse para quem ja tem conta.
export async function settleAllDeferredAffiliates(): Promise<void> {
  // quem teve a abertura recusada por dados (ex.: CEP) espera a correcao no
  // painel — nao fica tentando de hora em hora com os mesmos dados
  const noAccount = await Affiliate.find({
    accountMode: "deferred",
    status: "active",
    asaasWalletId: "",
    $or: [{ accountOpenError: "" }, { accountOpenError: null }],
  }).select("_id");
  for (const a of noAccount) {
    const paying = await Subscription.findOne({
      affiliate: a._id,
      status: "active",
    }).select("establishment");
    if (!paying) continue;
    await openAffiliateAccount(a._id, {
      establishmentName: await establishmentNameOf(paying.establishment),
    });
  }

  const affs = await Affiliate.find({
    accountMode: "deferred",
    status: "active",
    asaasWalletId: { $ne: "" },
  }).select("_id");
  for (const a of affs) {
    await settleDeferredAffiliate(a._id);
  }
}

// nome do estabelecimento (para o e-mail de conta aberta)
export async function establishmentNameOf(id: unknown): Promise<string> {
  try {
    const est = await Establishment.findById(id).select("name");
    return est?.name || "";
  } catch {
    return "";
  }
}
