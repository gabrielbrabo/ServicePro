import { Request, Response } from "express";
import {
  openAffiliateAccount,
  commissionPayoutFor,
  settleDeferredAffiliate,
} from "../utils/affiliateAccount";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { Establishment } from "../models/Establishment";
import { User } from "../models/User";
import { Affiliate } from "../models/Affiliate";
import { AffiliateCommission } from "../models/AffiliateCommission";
import {
  sendCommissionReceivedEmail,
  sendNonRenewalEmail,
} from "../utils/affiliateEmails";
import { Subscription } from "../models/Subscription";
import { Booking } from "../models/Booking";
import {
  finalizeDepositPaid,
  finalizeServicePaid,
} from "./bookingController";
import { getPaymentProvider } from "../services/payments";
import { PLANS, getPlan, priceForCycle } from "../config/plans";
import { paymentsConfigured } from "../config/env";
import {
  INCLUDED_SEATS,
  seatsCycleTotalCents,
  nextSeatCycleCents,
  nextSeatChargeNowCents,
} from "../config/seats";
import { usedSeats, maxTeam } from "../utils/seatLimit";
import {
  findUsableCoupon,
  consumeCoupon,
  releaseCoupon,
  applyPercent,
  effectivePlanCents,
  discountActive,
  describeCoupon,
} from "../utils/coupons";
import { ICoupon } from "../models/Coupon";
import {
  INCLUDED_GALLERY_SLOTS,
  GALLERY_PACK_SLOTS,
  GALLERY_PACK_MONTHLY_CENTS,
  galleryCycleTotalCents,
  nextGalleryPackChargeNowCents,
} from "../config/gallery";
import { usedGallerySlots, maxGallerySlots } from "../utils/galleryLimit";
import { ISubscription } from "../models/Subscription";

// carrega o estabelecimento e confirma que o usuario logado e o DONO
async function loadOwned(estId: string, userId?: string) {
  const est = await Establishment.findById(estId);
  if (!est) return { est: null, owned: false };
  return { est, owned: est.owner.toString() === userId };
}

// GET /api/subscriptions/:establishmentId/status  (dono OU membro)
// Status leve para o painel decidir se libera o uso (paywall). Qualquer membro
// do estabelecimento pode ler; so o dono paga.
export const getStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const est = await Establishment.findById(req.params.establishmentId).select(
      "owner members"
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    const isOwner = est.owner.toString() === req.userId;
    const isMember = est.members.some(
      (m) => m.professional?.toString() === req.userId
    );
    if (!isOwner && !isMember) {
      res.status(403).json({ message: "Sem acesso" });
      return;
    }

    const sub = await Subscription.findOne({
      establishment: est._id,
    }).select("status trialEndsAt");
    const status = sub?.status || "none";
    const entitled =
      status === "active" ||
      (status === "trialing" &&
        (!sub?.trialEndsAt || sub.trialEndsAt.getTime() > Date.now()));

    res.json({
      status,
      entitled,
      paymentsEnabled: paymentsConfigured(),
      isOwner,
    });
  } catch (err) {
    console.error("getStatus:", err);
    res.status(500).json({ message: "Erro ao consultar status" });
  }
};

// GET /api/subscriptions/plans  (protegido)
export const listPlans = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ plans: Object.values(PLANS) });
};

// GET /api/subscriptions/:establishmentId  (dono)
export const getMySubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono acessa a assinatura" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: est._id });
    res.json({ subscription: sub });
  } catch (err) {
    console.error("getMySubscription:", err);
    res.status(500).json({ message: "Erro ao carregar assinatura" });
  }
};

// GET /api/subscriptions/:establishmentId/pix  (dono)
// Devolve o QR/copia-e-cola do PIX da cobranca pendente da assinatura, para o
// painel mostrar mesmo quando a assinatura foi criada no cadastro.
export const getSubscriptionPixCode = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est || !owned) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }
    const sub = await Subscription.findOne({ establishment: est._id });
    if (!sub?.providerSubscriptionId) {
      res.json({ pixQrImage: null, pixCopiaECola: null, checkoutUrl: null });
      return;
    }
    const provider = getPaymentProvider();
    if (!provider.getSubscriptionPix) {
      res.json({ pixQrImage: null, pixCopiaECola: null, checkoutUrl: null });
      return;
    }
    const pix = await provider.getSubscriptionPix(sub.providerSubscriptionId);
    res.json({
      pixQrImage: pix.image,
      pixCopiaECola: pix.payload,
      checkoutUrl: pix.checkoutUrl,
    });
  } catch (err) {
    console.error("getSubscriptionPixCode:", err);
    res.json({ pixQrImage: null, pixCopiaECola: null, checkoutUrl: null });
  }
};

// POST /api/subscriptions/:establishmentId  (dono)
// body: { planId, billingCycle?, method, cardToken?, cpfCnpj?, phone? }
export const subscribe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono pode assinar" });
      return;
    }

    const {
      planId,
      billingCycle: cycleRaw,
      method = "pix",
      cardToken,
      cpfCnpj,
      phone,
      email,
      card,
      holderInfo,
      couponCode,
    } = req.body as {
      couponCode?: string;
      planId?: string;
      billingCycle?: "mensal" | "anual";
      method?: "pix" | "cartao" | "boleto";
      cardToken?: string;
      cpfCnpj?: string;
      phone?: string;
      email?: string;
      card?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      holderInfo?: { postalCode: string; addressNumber: string; phone: string };
    };

    // cartao digitado no app exige os dados do titular
    if (method === "cartao" && (!card || !holderInfo)) {
      res.status(400).json({ message: "Dados do cartão incompletos" });
      return;
    }

    const plan = getPlan(planId);
    if (!plan) {
      res.status(400).json({ message: "Plano invalido" });
      return;
    }
    const billingCycle = cycleRaw || est.billingCycle || "mensal";
    const priceCents = priceForCycle(plan, billingCycle);

    // impede assinar duas vezes: se ja ha assinatura vigente, bloqueia
    // (se estiver cancelada mas ainda no periodo, o caminho e Reativar)
    const existing = await Subscription.findOne({ establishment: est._id });
    // periodo gratis (cupom) SEM assinatura no gateway: pode assinar — a 1a
    // cobranca fica para o fim do periodo gratis (nao perde os dias gratis)
    const trialNoGateway =
      !!existing &&
      existing.status === "trialing" &&
      !existing.providerSubscriptionId;
    const trialEndsAt =
      trialNoGateway &&
      existing!.trialEndsAt &&
      existing!.trialEndsAt.getTime() > Date.now()
        ? existing!.trialEndsAt
        : null;
    if (
      existing &&
      !trialNoGateway &&
      (existing.status === "active" || existing.status === "trialing")
    ) {
      res.status(409).json({
        message: existing.cancelAtPeriodEnd
          ? "Sua assinatura está ativa até o fim do período. Use Reativar em vez de assinar de novo."
          : "Você já tem uma assinatura ativa.",
      });
      return;
    }

    const owner = await User.findById(est.owner).select(
      "name email referredByAffiliate"
    );
    if (!owner) {
      res.status(400).json({ message: "Dono nao encontrado" });
      return;
    }

    // cupom de DESCONTO na assinatura (o de meses gratis usa /coupon)
    let coupon: ICoupon | null = null;
    if (couponCode && String(couponCode).trim()) {
      const check = await findUsableCoupon(couponCode, {
        ownerId: String(est.owner),
        cycle: billingCycle,
      });
      if (!check.ok) {
        res.status(400).json({ message: check.message });
        return;
      }
      if (check.coupon.type !== "discount") {
        res.status(400).json({
          message:
            "Este é um cupom de meses grátis: use o botão Aplicar cupom (não precisa de pagamento).",
        });
        return;
      }
      coupon = check.coupon;
    }
    // valor cobrado do plano (com desconto do cupom, se houver). A comissao do
    // afiliado (split) sai sobre ESTE valor: 25% do que foi pago.
    const chargeCents = coupon
      ? applyPercent(priceCents, coupon.percent)
      : priceCents;

    // afiliado/representante que indicou o dono: se ativo e com subconta, injeta
    // split (25%) na assinatura (o Asaas repassa a cada cobranca) e guarda o
    // vinculo na assinatura para o painel/contabilizacao.
    let affiliateId: Types.ObjectId | null = null;
    let affiliateWalletId = "";
    let affiliatePercent = 0;
    if (owner.referredByAffiliate) {
      const aff = await Affiliate.findOne({
        _id: owner.referredByAffiliate,
        status: "active",
      }).select(
        "asaasWalletId commissionPercent user approved accountMode +asaasApiKey"
      );
      // anti-autoindicacao: o afiliado nao recebe comissao por indicar o proprio
      // estabelecimento (mesma conta como afiliado e como dono).
      const selfReferral =
        aff && aff.user && aff.user.toString() === est.owner.toString();

      // modelo novo (deferred) sem subconta ainda: a assinatura sai SEM split
      // e so com a ATRIBUICAO. A subconta so e aberta quando o 1o pagamento
      // CONFIRMAR (creditAffiliate) — assim o custo de abertura no Asaas so
      // existe quando entra dinheiro. Essa 1a comissao fica "a repassar".
      if (
        aff &&
        !aff.asaasWalletId &&
        !selfReferral &&
        aff.accountMode === "deferred"
      ) {
        affiliateId = aff._id;
        affiliatePercent = aff.commissionPercent || 25;
      }

      if (aff && aff.asaasWalletId && !selfReferral) {
        // Aplica o split sempre que o afiliado tem carteira. NAO dependemos mais
        // de uma checagem de "aprovacao" ao vivo aqui: ela quebrava quando a
        // apiKey da subconta era de outro ambiente ("chave nao pertence a este
        // ambiente") e zerava o afiliado silenciosamente. Se a carteira for
        // invalida, a resiliencia do provider refaz a assinatura SEM split (sem
        // travar o estabelecimento). O "so libera apos aprovacao" continua
        // valendo na GERACAO do link (o afiliado nem compartilha antes de aprovar).
        affiliateId = aff._id;
        affiliateWalletId = aff.asaasWalletId;
        affiliatePercent = aff.commissionPercent || 25;
        console.log(
          `[affiliate-split] est=${est._id} wallet=${affiliateWalletId} ` +
            `percent=${affiliatePercent} priceCents=${priceCents}`
        );
      }
    }

    const provider = getPaymentProvider();

    // reaproveita o customer do gateway se ja existir
    let sub = await Subscription.findOne({ establishment: est._id });
    let customerId = sub?.providerCustomerId || "";
    if (!customerId) {
      const c = await provider.createCustomer({
        name: owner.name,
        email: email?.trim() || owner.email,
        cpfCnpj,
        phone,
        externalRef: est._id.toString(),
      });
      customerId = c.customerId;
    }

    if (coupon && !(await consumeCoupon(coupon, est.owner, est._id))) {
      res.status(409).json({ message: "Este cupom não está mais disponível." });
      return;
    }

    let result;
    try {
    result = await provider.createSubscription({
      customerId,
      planId: plan.id,
      priceCents: chargeCents,
      firstDueDate: trialEndsAt || undefined,
      billingCycle,
      method,
      cardToken,
      card,
      holderInfo:
        method === "cartao" && card && holderInfo
          ? {
              name: owner.name,
              email: email?.trim() || owner.email,
              cpfCnpj: cpfCnpj || "",
              postalCode: holderInfo.postalCode,
              addressNumber: holderInfo.addressNumber,
              phone: holderInfo.phone,
            }
          : undefined,
      splitWalletId: affiliateWalletId || undefined,
      splitPercent: affiliateWalletId ? affiliatePercent : undefined,
      remoteIp: req.ip,
      externalRef: est._id.toString(),
    });
    } catch (e) {
      // pagamento recusado/erro no gateway: devolve o uso do cupom
      if (coupon) await releaseCoupon(coupon, est.owner);
      throw e;
    }

    const data = {
      establishment: est._id,
      owner: est.owner,
      planId: plan.id,
      billingCycle,
      priceCents,
      // ainda no periodo gratis: continua "trialing"; a 1a cobranca vence no
      // fim do periodo (webhook de pagamento -> active)
      status: trialEndsAt ? "trialing" : result.status,
      provider: provider.name,
      providerCustomerId: customerId,
      providerSubscriptionId: result.subscriptionId,
      currentPeriodEnd: trialEndsAt || result.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      // desconto do cupom (-1 = para sempre); sem cupom zera o de antes
      couponCode: coupon ? coupon.code : existing?.couponCode || "",
      discountPercent: coupon ? coupon.percent : 0,
      discountChargesLeft: coupon ? coupon.discountCharges : 0,
      cardLast4: result.cardLast4 || "",
      cardBrand: result.cardBrand || "",
      // ATRIBUICAO (quem indicou) e gravada SEMPRE que houve afiliado -> o
      // indicado aparece no painel mesmo que o split de dinheiro tenha caido
      // (ex.: carteira de outro ambiente). Ja o walletId (dinheiro fluindo) so
      // fica preenchido quando o split foi REALMENTE aplicado no gateway; se
      // caiu, guardamos vazio pra deixar claro que a comissao nao esta fluindo.
      affiliate: affiliateId,
      affiliateWalletId: result.splitApplied === false ? "" : affiliateWalletId,
    };

    sub = await Subscription.findOneAndUpdate(
      { establishment: est._id },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // no periodo gratis nao ha nada a pagar agora (1a cobranca vence depois)
    res.json({
      subscription: sub,
      checkoutUrl: trialEndsAt ? null : result.checkoutUrl ?? null,
      pixQrImage: trialEndsAt ? null : result.pixQrImage ?? null,
      pixCopiaECola: trialEndsAt ? null : result.pixCopiaECola ?? null,
    });
  } catch (err) {
    console.error("subscribe:", err);
    res.status(500).json({ message: "Erro ao criar assinatura" });
  }
};

// POST /api/subscriptions/:establishmentId/cancel  (dono)
export const cancelSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono pode cancelar" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: est._id });
    if (!sub) {
      res.status(404).json({ message: "Assinatura nao encontrada" });
      return;
    }

    // agenda o fim no gateway para o vencimento atual (nao renova mais, mas
    // mantem as cobrancas ja geradas / o periodo pago)
    if (sub.providerSubscriptionId) {
      try {
        await getPaymentProvider().cancelSubscription(
          sub.providerSubscriptionId,
          sub.currentPeriodEnd || undefined
        );
      } catch (e) {
        // id antigo/inexistente no gateway (ex.: sobra do modo noop) nao deve
        // impedir o cancelamento local
        console.warn(
          "cancel no gateway falhou, cancelando local:",
          (e as Error).message
        );
      }
    }

    // Cancelamento profissional: agenda o fim para o vencimento atual. O cliente
    // MANTEM o acesso ate currentPeriodEnd (ja pagou) e nao e mais cobrado.
    // Se ja passou do periodo (ou nao ha data), cancela de imediato.
    const periodOver =
      !sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() <= Date.now();
    sub.cancelAtPeriodEnd = true;
    sub.canceledAt = new Date();
    sub.status = periodOver ? "canceled" : "active";
    await sub.save();

    res.json({ subscription: sub });
  } catch (err) {
    console.error("cancelSubscription:", err);
    res.status(500).json({ message: "Erro ao cancelar assinatura" });
  }
};

// POST /api/subscriptions/:establishmentId/reactivate  (dono)
// Desfaz um cancelamento agendado: volta a renovar, SEM cobrar de novo (a
// proxima cobranca fica para o fim do periodo atual).
export const reactivateSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono pode reativar" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: est._id });
    if (!sub || !sub.cancelAtPeriodEnd) {
      res.status(400).json({ message: "Nao ha cancelamento para reverter" });
      return;
    }

    const provider = getPaymentProvider();
    const nextDue = sub.currentPeriodEnd || new Date();
    if (provider.reactivateSubscription && sub.providerSubscriptionId) {
      await provider.reactivateSubscription(sub.providerSubscriptionId, nextDue);
    }

    sub.cancelAtPeriodEnd = false;
    sub.canceledAt = null;
    sub.status = "active";
    await sub.save();

    res.json({ subscription: sub });
  } catch (err) {
    console.error("reactivateSubscription:", err);
    res.status(500).json({ message: "Erro ao reativar a assinatura" });
  }
};

// POST /api/subscriptions/:establishmentId/refresh  (dono)
// Consulta o status direto no gateway e atualiza — util pra confirmar o
// pagamento sem depender do webhook (ex.: testar sem ngrok).
export const refreshStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono acessa a assinatura" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: est._id });
    if (!sub) {
      res.status(404).json({ message: "Assinatura nao encontrada" });
      return;
    }

    const provider = getPaymentProvider();
    if (provider.fetchStatus && sub.providerSubscriptionId) {
      const info = await provider.fetchStatus(sub.providerSubscriptionId);
      // periodo gratis (cupom) ainda correndo: a 1a cobranca so vence no fim
      // dele — "pendente" no gateway nao pode bloquear o uso
      const inTrial =
        sub.status === "trialing" &&
        !!sub.trialEndsAt &&
        sub.trialEndsAt.getTime() > Date.now();
      if (info && !(inTrial && info.status === "past_due")) {
        sub.status = info.status;
        if (info.currentPeriodEnd) sub.currentPeriodEnd = info.currentPeriodEnd;
        await sub.save();
      }
    }

    res.json({ subscription: sub });
  } catch (err) {
    console.error("refreshStatus:", err);
    res.status(500).json({ message: "Erro ao atualizar o status" });
  }
};

// ---- Extras da assinatura (assentos de equipe + espaco de galeria) ----

// valor recorrente da assinatura = base do plano + assentos pagos + espaco extra
// de galeria. Recalculado do zero a partir dos campos da assinatura (idempotente).
function subscriptionRecurringValueCents(sub: ISubscription): number {
  const plan = getPlan(sub.planId);
  const full = plan ? priceForCycle(plan, sub.billingCycle) : sub.priceCents;
  // desconto de cupom ainda valendo
  const base = effectivePlanCents(sub, full);
  return (
    base +
    seatsCycleTotalCents(sub.extraSeats || 0, sub.billingCycle) +
    galleryCycleTotalCents(sub.extraGallerySlots || 0, sub.billingCycle)
  );
}

// atualiza o valor recorrente no gateway com o estado atual da assinatura
async function pushRecurringValue(
  sub: ISubscription,
  updatePendingPayments = false
): Promise<void> {
  const provider = getPaymentProvider();
  if (provider.updateSubscriptionValue && sub.providerSubscriptionId) {
    try {
      await provider.updateSubscriptionValue(
        sub.providerSubscriptionId,
        subscriptionRecurringValueCents(sub),
        updatePendingPayments
      );
    } catch (e) {
      console.warn("updateSubscriptionValue falhou:", (e as Error).message);
    }
  }
}

// Concede o(s) assento(s) pago(s): sobe extraSeats para o alvo e atualiza o
// valor recorrente no gateway. Idempotente (nao desce nem duplica).
async function grantSeat(
  sub: ISubscription,
  targetExtra: number
): Promise<void> {
  if (targetExtra <= (sub.extraSeats || 0)) {
    // ja concedido: so limpa a pendencia
    sub.seatPendingPaymentId = "";
    sub.seatPendingExtra = 0;
    await sub.save();
    return;
  }
  sub.extraSeats = targetExtra;
  sub.seatPendingPaymentId = "";
  sub.seatPendingExtra = 0;
  await sub.save();
  await pushRecurringValue(sub);
}

// Concede o espaco de galeria pago: sobe extraGallerySlots para o alvo e
// atualiza o valor recorrente no gateway. Idempotente.
async function grantGallery(
  sub: ISubscription,
  targetSlots: number
): Promise<void> {
  if (targetSlots <= (sub.extraGallerySlots || 0)) {
    sub.galleryPendingPaymentId = "";
    sub.galleryPendingSlots = 0;
    await sub.save();
    return;
  }
  sub.extraGallerySlots = targetSlots;
  sub.galleryPendingPaymentId = "";
  sub.galleryPendingSlots = 0;
  await sub.save();
  await pushRecurringValue(sub);
}

// GET /api/subscriptions/:establishmentId/seats  (dono)
// Situacao dos assentos: quantos usa, limite, preco do proximo, e se ha uma
// compra PIX pendente (consulta o gateway e concede se ja pagou).
export const getSeats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono gerencia assentos" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: est._id });
    const cycle = sub?.billingCycle || est.billingCycle || "mensal";
    const extra = sub?.extraSeats || 0;

    // ha compra PIX pendente? consulta o gateway; se pago, concede na hora
    let pending = !!sub?.seatPendingPaymentId;
    if (sub && sub.seatPendingPaymentId) {
      const provider = getPaymentProvider();
      if (provider.getChargeStatus) {
        try {
          const st = await provider.getChargeStatus(sub.seatPendingPaymentId);
          if (st.status === "confirmed") {
            await grantSeat(sub, sub.seatPendingExtra);
            pending = false;
          } else if (st.status === "canceled") {
            sub.seatPendingPaymentId = "";
            sub.seatPendingExtra = 0;
            await sub.save();
            pending = false;
          }
        } catch {
          // sem status agora; mantem pendente
        }
      }
    }

    const currentExtra = sub?.extraSeats || 0;
    const used = usedSeats(est);
    const max = maxTeam(currentExtra);

    res.json({
      used,
      includedSeats: INCLUDED_SEATS,
      extraSeats: currentExtra,
      max,
      canAdd: used < max,
      billingCycle: cycle,
      // preco do proximo assento por ciclo e o valor a cobrar agora
      nextSeatPriceCents: nextSeatCycleCents(currentExtra, cycle),
      nextSeatChargeNowCents: nextSeatChargeNowCents(
        currentExtra,
        cycle,
        sub?.currentPeriodEnd || null
      ),
      pending,
      hasSubscription: !!sub,
    });
  } catch (err) {
    console.error("getSeats:", err);
    res.status(500).json({ message: "Erro ao consultar assentos" });
  }
};

// POST /api/subscriptions/:establishmentId/seats  (dono)
// Compra 1 assento extra. Cobra AGORA na conta da PLATAFORMA (sem split):
//  - cartao: confirma na hora e ja concede o assento
//  - pix: devolve QR/copia-e-cola; concede quando o pagamento constar
// body: { method: "pix"|"cartao", cpfCnpj?, card?, holderInfo? }
export const buySeat = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono compra assentos" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: est._id });
    if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
      res.status(400).json({
        message: "Tenha uma assinatura ativa para comprar assentos.",
      });
      return;
    }

    const provider = getPaymentProvider();
    if (!provider.createCharge) {
      res.status(400).json({ message: "Pagamentos indisponiveis." });
      return;
    }

    const {
      method = "pix",
      cpfCnpj,
      card,
      holderInfo,
    } = req.body as {
      method?: "pix" | "cartao";
      cpfCnpj?: string;
      card?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      holderInfo?: { postalCode: string; addressNumber: string; phone: string };
    };

    if (method === "cartao" && (!card || !holderInfo)) {
      res.status(400).json({ message: "Dados do cartão incompletos" });
      return;
    }

    const owner = await User.findById(est.owner).select("name email");
    if (!owner) {
      res.status(400).json({ message: "Dono nao encontrado" });
      return;
    }

    const currentExtra = sub.extraSeats || 0;
    const targetExtra = currentExtra + 1;
    const chargeNow = nextSeatChargeNowCents(
      currentExtra,
      sub.billingCycle,
      sub.currentPeriodEnd || null
    );

    const charge = await provider.createCharge({
      billingType: method,
      customerName: owner.name,
      customerEmail: owner.email,
      customerCpfCnpj: cpfCnpj || "",
      valueCents: chargeNow,
      description: `ServiçosPro — assento de funcionário (${est.name})`,
      externalReference: `seat:${est._id.toString()}`,
      splitWalletId: "",
      platform: true, // receita da empresa: sem split, na conta principal
      card,
      holderInfo:
        method === "cartao" && card && holderInfo
          ? {
              name: owner.name,
              email: owner.email,
              cpfCnpj: cpfCnpj || "",
              postalCode: holderInfo.postalCode,
              addressNumber: holderInfo.addressNumber,
              phone: holderInfo.phone,
            }
          : undefined,
      remoteIp: req.ip,
    });

    // guarda a pendencia (o webhook/poll concede quando confirmar)
    sub.seatPendingPaymentId = charge.paymentId;
    sub.seatPendingExtra = targetExtra;
    await sub.save();

    // cartao confirmado na hora -> concede ja
    if (charge.status === "confirmed") {
      await grantSeat(sub, targetExtra);
      res.json({ granted: true, extraSeats: targetExtra });
      return;
    }

    // pix pendente -> devolve o QR para o app exibir
    res.json({
      granted: false,
      paymentId: charge.paymentId,
      pixQrImage: charge.pixQrImage ?? null,
      pixCopiaECola: charge.pixCopiaECola ?? null,
      chargeNowCents: chargeNow,
    });
  } catch (err) {
    console.error("buySeat:", err);
    res.status(500).json({ message: "Erro ao comprar assento" });
  }
};

// ---- Espaco de galeria (armazenamento) ----

// GET /api/subscriptions/:establishmentId/gallery  (dono)
// Situacao do espaco: usado, limite, restante e preco do proximo pacote.
// Consulta uma compra PIX pendente e concede se ja pagou.
export const getGallery = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    // dono OU membro pode VER o espaco (funcionario tambem publica fotos).
    // So o dono compra pacote (isso fica no endpoint buyGallery, dono-only).
    const isMember = est.members.some(
      (m) => m.professional?.toString() === req.userId
    );
    if (!owned && !isMember) {
      res.status(403).json({ message: "Sem acesso" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: est._id });
    const cycle = sub?.billingCycle || est.billingCycle || "mensal";

    // compra PIX pendente? consulta o gateway; concede se pago.
    // So o dono dispara isso (e quem paga); membro apenas le o uso.
    let pending = !!sub?.galleryPendingPaymentId;
    if (owned && sub && sub.galleryPendingPaymentId) {
      const provider = getPaymentProvider();
      if (provider.getChargeStatus) {
        try {
          const st = await provider.getChargeStatus(
            sub.galleryPendingPaymentId
          );
          if (st.status === "confirmed") {
            await grantGallery(sub, sub.galleryPendingSlots);
            pending = false;
          } else if (st.status === "canceled") {
            sub.galleryPendingPaymentId = "";
            sub.galleryPendingSlots = 0;
            await sub.save();
            pending = false;
          }
        } catch {
          // sem status agora; mantem pendente
        }
      }
    }

    const extra = sub?.extraGallerySlots || 0;
    const { used, singles, bas } = await usedGallerySlots(est._id);
    const max = maxGallerySlots(extra);

    res.json({
      used,
      singles, // qtde de fotos normais publicadas
      bas, // qtde de antes/depois publicados
      includedSlots: INCLUDED_GALLERY_SLOTS,
      extraSlots: extra,
      max,
      remaining: Math.max(0, max - used),
      billingCycle: cycle,
      packSlots: GALLERY_PACK_SLOTS,
      packPriceCents: GALLERY_PACK_MONTHLY_CENTS,
      packChargeNowCents: nextGalleryPackChargeNowCents(
        cycle,
        sub?.currentPeriodEnd || null
      ),
      isOwner: owned, // so o dono ve o botao de comprar espaco
      pending,
      hasSubscription: !!sub,
    });
  } catch (err) {
    console.error("getGallery:", err);
    res.status(500).json({ message: "Erro ao consultar o espaco" });
  }
};

// POST /api/subscriptions/:establishmentId/gallery  (dono)
// Compra 1 pacote de espaco. Cobra AGORA na conta da PLATAFORMA (sem split):
//  - cartao: confirma na hora e ja concede o espaco
//  - pix: devolve QR; concede quando o pagamento constar
// body: { method, cpfCnpj?, card?, holderInfo? }
export const buyGallery = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono compra espaco" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: est._id });
    if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
      res.status(400).json({
        message: "Tenha uma assinatura ativa para comprar espaco.",
      });
      return;
    }

    const provider = getPaymentProvider();
    if (!provider.createCharge) {
      res.status(400).json({ message: "Pagamentos indisponiveis." });
      return;
    }

    const {
      method = "pix",
      cpfCnpj,
      card,
      holderInfo,
    } = req.body as {
      method?: "pix" | "cartao";
      cpfCnpj?: string;
      card?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      holderInfo?: { postalCode: string; addressNumber: string; phone: string };
    };

    if (method === "cartao" && (!card || !holderInfo)) {
      res.status(400).json({ message: "Dados do cartão incompletos" });
      return;
    }

    const owner = await User.findById(est.owner).select("name email");
    if (!owner) {
      res.status(400).json({ message: "Dono nao encontrado" });
      return;
    }

    const targetSlots = (sub.extraGallerySlots || 0) + GALLERY_PACK_SLOTS;
    const chargeNow = nextGalleryPackChargeNowCents(
      sub.billingCycle,
      sub.currentPeriodEnd || null
    );

    const charge = await provider.createCharge({
      billingType: method,
      customerName: owner.name,
      customerEmail: owner.email,
      customerCpfCnpj: cpfCnpj || "",
      valueCents: chargeNow,
      description: `ServiçosPro — espaço de galeria +${GALLERY_PACK_SLOTS} (${est.name})`,
      externalReference: `gallery:${est._id.toString()}`,
      splitWalletId: "",
      platform: true, // receita da empresa: sem split, na conta principal
      card,
      holderInfo:
        method === "cartao" && card && holderInfo
          ? {
              name: owner.name,
              email: owner.email,
              cpfCnpj: cpfCnpj || "",
              postalCode: holderInfo.postalCode,
              addressNumber: holderInfo.addressNumber,
              phone: holderInfo.phone,
            }
          : undefined,
      remoteIp: req.ip,
    });

    sub.galleryPendingPaymentId = charge.paymentId;
    sub.galleryPendingSlots = targetSlots;
    await sub.save();

    if (charge.status === "confirmed") {
      await grantGallery(sub, targetSlots);
      res.json({ granted: true, extraSlots: targetSlots });
      return;
    }

    res.json({
      granted: false,
      paymentId: charge.paymentId,
      pixQrImage: charge.pixQrImage ?? null,
      pixCopiaECola: charge.pixCopiaECola ?? null,
      chargeNowCents: chargeNow,
    });
  } catch (err) {
    console.error("buyGallery:", err);
    res.status(500).json({ message: "Erro ao comprar espaco" });
  }
};

// Efeitos de afiliado/representante disparados pelo webhook de assinatura:
//  - payment_confirmed -> registra a comissao (idempotente por paymentId) e
//    avisa o afiliado por e-mail (pagou na 1a; renovou nas seguintes).
//  - payment_overdue   -> avisa o afiliado que o indicado nao renovou.
// Fire-and-forget do ponto de vista do webhook (o chamador engole erros).
async function creditAffiliate(
  sub: ISubscription,
  event: { type: string; paymentId?: string; grossCents?: number }
): Promise<void> {
  const aff = await Affiliate.findById(sub.affiliate);
  if (!aff) return;
  const owner = await User.findById(aff.user).select("email");
  const est = await Establishment.findById(sub.establishment).select("name");
  const establishmentName = est?.name || "Estabelecimento";
  const to = owner?.email || "";

  if (event.type === "payment_confirmed") {
    const paymentId = event.paymentId || "";
    // sem id de pagamento nao ha chave de idempotencia: nao registra em dobro
    if (!paymentId) return;
    const exists = await AffiliateCommission.findOne({ paymentId }).select("_id");
    if (exists) return;

    const percent = aff.commissionPercent || 25;
    // 25% do valor do plano efetivamente pago (com desconto de cupom, se houve)
    const grossCents = event.grossCents ?? sub.priceCents;
    const commissionCents = Math.round((grossCents * percent) / 100);
    // 1a comissao desta assinatura = "paid"; as seguintes = "renewed"
    const prior = await AffiliateCommission.countDocuments({
      subscription: sub._id,
    });
    const type: "paid" | "renewed" = prior > 0 ? "renewed" : "paid";

    // 1o pagamento confirmado de um indicado de afiliado deferred sem
    // subconta: abre a conta de recebimento AGORA (so agora gera custo)
    if (aff.accountMode === "deferred" && !aff.asaasWalletId) {
      await openAffiliateAccount(aff._id, { establishmentName });
    }

    // sem split aplicado (afiliado deferred com conta ainda nao aprovada):
    // a comissao fica "a repassar" e e transferida quando a conta aprovar
    const payout = commissionPayoutFor(aff, sub);
    await AffiliateCommission.create({
      affiliate: aff._id,
      subscription: sub._id,
      establishment: sub.establishment || null,
      paymentId,
      grossCents,
      commissionPercent: percent,
      commissionCents,
      type,
      paidAt: new Date(),
      payout,
    });

    const plan = getPlan(sub.planId);
    if (to) {
      sendCommissionReceivedEmail({
        to,
        establishmentName,
        planName: plan?.name || sub.planId,
        commissionCents,
        renewed: type === "renewed",
        pending: payout === "pending",
      });
    }
    // conta ja aprovada? repassa/ajusta na hora (senao o job tenta depois)
    if (payout === "pending") void settleDeferredAffiliate(aff._id);
  } else if (event.type === "payment_overdue") {
    if (to) sendNonRenewalEmail({ to, establishmentName });
  } else if (event.type === "payment_refunded") {
    // estorno/chargeback: reverte a comissao daquele pagamento (o Asaas ja
    // reverteu o split). Nao inflamos o "recebido" do painel.
    const paymentId = event.paymentId || "";
    if (!paymentId) return;
    const commission = await AffiliateCommission.findOne({ paymentId });
    if (commission && !commission.reversed) {
      commission.reversed = true;
      commission.reversedAt = new Date();
      await commission.save();
    }
  }
}

// Reconcilia as comissoes de UMA assinatura direto na API do gateway: busca os
// pagamentos ja confirmados e registra no ledger os que ainda faltam (idempotente
// por paymentId). Serve de rede de seguranca quando o webhook nao chegou. Recebe
// os campos da assinatura (aceita doc ou objeto lean). Falha silenciosa.
export async function reconcileAffiliateForSubscription(sub: {
  _id: Types.ObjectId | string;
  affiliate?: Types.ObjectId | string | null;
  providerSubscriptionId?: string;
  establishment?: Types.ObjectId | string | null;
  planId: string;
  affiliateWalletId?: string | null;
}): Promise<void> {
  try {
    if (!sub.affiliate || !sub.providerSubscriptionId) return;
    const provider = getPaymentProvider();
    if (!provider.listConfirmedPayments) return;

    const payments = await provider.listConfirmedPayments(
      sub.providerSubscriptionId
    );
    if (!payments.length) return;

    const aff = await Affiliate.findById(sub.affiliate);
    if (!aff) return;
    const percent = aff.commissionPercent || 25;
    const owner = await User.findById(aff.user).select("email");
    const est = await Establishment.findById(sub.establishment).select("name");
    const establishmentName = est?.name || "Estabelecimento";
    const to = owner?.email || "";
    const plan = getPlan(sub.planId);

    // indicado ja pagou e o afiliado deferred ainda nao tem subconta (webhook
    // nao chegou): abre a conta de recebimento
    if (aff.accountMode === "deferred" && !aff.asaasWalletId) {
      await openAffiliateAccount(aff._id, { establishmentName });
    }

    for (const p of payments) {
      if (!p.paymentId) continue;
      const exists = await AffiliateCommission.findOne({
        paymentId: p.paymentId,
      }).select("_id");
      if (exists) continue;
      const grossCents = p.valueCents || 0;
      const commissionCents = Math.round((grossCents * percent) / 100);
      const prior = await AffiliateCommission.countDocuments({
        subscription: sub._id,
      });
      const type: "paid" | "renewed" = prior > 0 ? "renewed" : "paid";
      await AffiliateCommission.create({
        affiliate: aff._id,
        subscription: sub._id,
        establishment: sub.establishment || null,
        paymentId: p.paymentId,
        grossCents,
        commissionPercent: percent,
        commissionCents,
        type,
        paidAt: new Date(),
        payout: commissionPayoutFor(aff, sub),
      });
      if (to) {
        sendCommissionReceivedEmail({
          to,
          establishmentName,
          planName: plan?.name || sub.planId,
          commissionCents,
          renewed: type === "renewed",
          pending: commissionPayoutFor(aff, sub) === "pending",
        });
      }
    }
  } catch (e) {
    console.error("reconcileAffiliateForSubscription:", (e as Error).message);
  }
}

// POST /api/webhooks/payments  (SEM auth de usuario; validado pelo gateway)
// Fonte da verdade do "pago". Idempotente via lastEventId.
export const paymentsWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const provider = getPaymentProvider();
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

    if (!provider.verifyWebhook(rawBody, req.headers)) {
      res.status(401).json({ message: "Webhook nao autenticado" });
      return;
    }

    const event = provider.parseWebhook(req.body);
    if (!event) {
      res.json({ ok: true }); // evento irrelevante: confirma e ignora
      return;
    }

    // cobrancas avulsas do cliente (nao tem assinatura):
    //  - "booking-service:<id>" = pagamento do serviço -> marca pago + caixa
    //  - "booking:<id>"         = sinal -> marca recebido + caixa
    const ref = event.externalReference || "";
    if (ref.startsWith("booking-service:")) {
      if (event.type === "payment_confirmed") {
        const id = ref.slice("booking-service:".length);
        const booking = await Booking.findById(id);
        if (booking && booking.payment.status !== "pago") {
          if (event.paymentId) booking.payment.servicePaymentId = event.paymentId;
          await finalizeServicePaid(booking, "pix");
        }
      }
      res.json({ ok: true });
      return;
    }
    if (ref.startsWith("booking:")) {
      if (event.type === "payment_confirmed") {
        const id = ref.slice("booking:".length);
        const booking = await Booking.findById(id);
        if (booking && !booking.payment.depositPaid) {
          if (event.paymentId) booking.payment.depositPaymentId = event.paymentId;
          await finalizeDepositPaid(booking, "pix");
        }
      }
      res.json({ ok: true });
      return;
    }
    // "seat:<estId>" = compra de assento de funcionario (receita da plataforma)
    if (ref.startsWith("seat:")) {
      if (event.type === "payment_confirmed") {
        const id = ref.slice("seat:".length);
        const seatSub = await Subscription.findOne({ establishment: id });
        if (seatSub && seatSub.seatPendingExtra) {
          await grantSeat(seatSub, seatSub.seatPendingExtra);
        }
      }
      res.json({ ok: true });
      return;
    }
    // "gallery:<estId>" = compra de espaco de galeria (receita da plataforma)
    if (ref.startsWith("gallery:")) {
      if (event.type === "payment_confirmed") {
        const id = ref.slice("gallery:".length);
        const gSub = await Subscription.findOne({ establishment: id });
        if (gSub && gSub.galleryPendingSlots) {
          await grantGallery(gSub, gSub.galleryPendingSlots);
        }
      }
      res.json({ ok: true });
      return;
    }

    const sub = await Subscription.findOne({
      providerSubscriptionId: event.providerSubscriptionId,
    });
    if (!sub) {
      res.json({ ok: true }); // nao e nosso: confirma p/ o gateway nao reenviar
      return;
    }

    // idempotencia: mesmo evento chegando 2x nao reaplica
    if (event.id && sub.lastEventId === event.id) {
      res.json({ ok: true });
      return;
    }

    // valor do plano cobrado NESTE pagamento (antes de descontar o contador)
    const planPaidCents = effectivePlanCents(sub, sub.priceCents);
    let discountEnded = false;
    if (event.type === "payment_confirmed") {
      // cupom de desconto por N cobrancas: conta esta; na ultima, volta o
      // preco cheio (inclusive na cobranca seguinte ja gerada)
      if ((sub.discountPercent || 0) > 0 && (sub.discountChargesLeft || 0) > 0) {
        sub.discountChargesLeft -= 1;
        if (sub.discountChargesLeft === 0) {
          sub.discountPercent = 0;
          discountEnded = true;
        }
      }
      sub.status = "active";
      // fim do periodo = vencimento pago + 1 ciclo (proxima cobranca)
      const base = event.currentPeriodEnd || new Date();
      const end = new Date(base);
      end.setMonth(end.getMonth() + (sub.billingCycle === "anual" ? 12 : 1));
      sub.currentPeriodEnd = end;
    } else if (event.type === "payment_overdue") {
      sub.status = "past_due";
    } else if (event.type === "subscription_canceled") {
      sub.status = "canceled";
      sub.canceledAt = new Date();
    }

    sub.lastEventId = event.id || sub.lastEventId;
    sub.lastEventAt = new Date();
    await sub.save();

    // fim do desconto do cupom: preco cheio no gateway + split no valor cheio
    if (discountEnded) {
      await pushRecurringValue(sub, true);
      await syncAffiliateSplit(sub);
    }

    // afiliado/representante: registra a comissao e avisa por e-mail. Nunca
    // derruba o webhook (erro aqui e apenas logado).
    if (sub.affiliate) {
      try {
        await creditAffiliate(sub, {
          type: event.type,
          paymentId: event.paymentId,
          grossCents: planPaidCents,
        });
      } catch (e) {
        console.error("creditAffiliate:", (e as Error).message);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("paymentsWebhook:", err);
    // 200 mesmo em erro interno evita retry infinito; logamos para investigar
    res.status(200).json({ ok: false });
  }
};

// ---- Cupons (meses gratis / desconto) ----

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

// atualiza o split do afiliado para 25% do valor do plano cobrado hoje (com
// ou sem desconto de cupom). So quando o split ja esta ativo na assinatura.
async function syncAffiliateSplit(sub: ISubscription): Promise<void> {
  try {
    if (!sub.affiliate || !sub.affiliateWalletId || !sub.providerSubscriptionId) {
      return;
    }
    const provider = getPaymentProvider();
    if (!provider.updateSubscriptionSplit) return;
    const aff = await Affiliate.findById(sub.affiliate).select("commissionPercent");
    const pct = aff?.commissionPercent || 25;
    const commission = Math.round(
      (effectivePlanCents(sub, sub.priceCents) * pct) / 100
    );
    await provider.updateSubscriptionSplit(
      sub.providerSubscriptionId,
      sub.affiliateWalletId,
      commission
    );
  } catch (e) {
    console.error("syncAffiliateSplit:", (e as Error).message);
  }
}

// POST /api/subscriptions/:establishmentId/coupon  (dono)  body: { code }
// Aplica um cupom no estabelecimento:
//  - meses gratis sem assinatura paga -> comeca/estende o periodo gratis
//    (usa o sistema sem pagar; no fim, assina)
//  - meses gratis com assinatura paga -> adia a proxima cobranca
//  - desconto com assinatura paga -> % nas proximas N cobrancas
//    (sem assinatura, o desconto e informado ao assinar)
export const redeemCoupon = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { est, owned } = await loadOwned(
      req.params.establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (!owned) {
      res.status(403).json({ message: "Apenas o dono pode usar cupom" });
      return;
    }

    let sub = await Subscription.findOne({ establishment: est._id });
    const cycle: "mensal" | "anual" =
      sub?.billingCycle || est.billingCycle || "mensal";
    const check = await findUsableCoupon(req.body?.code, {
      ownerId: String(est.owner),
      cycle,
    });
    if (!check.ok) {
      res.status(400).json({ message: check.message });
      return;
    }
    const coupon = check.coupon;
    const plan = getPlan(sub?.planId || est.segment);
    if (!plan) {
      res.status(400).json({ message: "Plano do estabelecimento nao definido" });
      return;
    }
    const provider = getPaymentProvider();
    const now = Date.now();
    // assinatura no gateway em dia (paga ou periodo gratis ja assinado)
    const paidActive =
      !!sub &&
      !!sub.providerSubscriptionId &&
      (sub.status === "active" || sub.status === "trialing");

    if (sub?.cancelAtPeriodEnd && paidActive) {
      res.status(400).json({
        message: "Reative a assinatura antes de usar um cupom.",
      });
      return;
    }

    if (coupon.type === "discount") {
      if (!paidActive || !sub) {
        res.status(400).json({
          message:
            "Cupom de desconto: informe o cupom no campo de cupom na hora de assinar.",
        });
        return;
      }
      if (discountActive(sub)) {
        res.status(409).json({
          message: "Sua assinatura já tem um desconto de cupom ativo.",
        });
        return;
      }
      if (!(await consumeCoupon(coupon, est.owner, est._id))) {
        res.status(409).json({ message: "Este cupom não está mais disponível." });
        return;
      }
      try {
        sub.couponCode = coupon.code;
        sub.discountPercent = coupon.percent;
        sub.discountChargesLeft = coupon.discountCharges;
        if (provider.updateSubscriptionValue) {
          // vale ja na proxima cobranca (inclusive a ja gerada e nao paga)
          await provider.updateSubscriptionValue(
            sub.providerSubscriptionId,
            subscriptionRecurringValueCents(sub),
            true
          );
        }
        await sub.save();
        await syncAffiliateSplit(sub);
      } catch (e) {
        await releaseCoupon(coupon, est.owner);
        console.error("redeemCoupon (desconto):", (e as Error).message);
        res.status(500).json({ message: "Não foi possível aplicar o cupom." });
        return;
      }
      res.json({
        subscription: sub,
        message: `Cupom aplicado: ${describeCoupon(coupon)}.`,
      });
      return;
    }

    // ---- meses gratis ----
    if (!(await consumeCoupon(coupon, est.owner, est._id))) {
      res.status(409).json({ message: "Este cupom não está mais disponível." });
      return;
    }
    try {
      if (paidActive && sub) {
        // ja paga: adia a proxima cobranca pelos meses gratis
        const base = Math.max(
          sub.currentPeriodEnd?.getTime() || 0,
          sub.trialEndsAt?.getTime() || 0,
          now
        );
        const next = addMonths(new Date(base), coupon.freeMonths);
        if (!provider.postponeSubscription) {
          throw new Error("gateway sem suporte a adiar cobranca");
        }
        await provider.postponeSubscription(sub.providerSubscriptionId, next);
        sub.currentPeriodEnd = next;
        if (sub.status === "trialing") sub.trialEndsAt = next;
        sub.couponCode = coupon.code;
        await sub.save();
      } else {
        // sem assinatura paga: periodo gratis (sem cartao). Se havia uma
        // cobranca inicial nao paga (ex.: PIX gerado e abandonado), cancela.
        if (sub?.providerSubscriptionId && sub.status !== "canceled") {
          try {
            await provider.cancelSubscription(sub.providerSubscriptionId);
          } catch (e) {
            console.warn(
              "redeemCoupon: cancelar cobranca pendente falhou:",
              (e as Error).message
            );
          }
        }
        const start =
          sub?.status === "trialing" &&
          sub.trialEndsAt &&
          sub.trialEndsAt.getTime() > now
            ? sub.trialEndsAt
            : new Date();
        const end = addMonths(start, coupon.freeMonths);

        // indicacao: o afiliado ja ve o indicado (em teste) no painel dele
        let affiliateId = sub?.affiliate || null;
        if (!affiliateId) {
          const owner = await User.findById(est.owner).select(
            "referredByAffiliate"
          );
          if (owner?.referredByAffiliate) {
            const aff = await Affiliate.findOne({
              _id: owner.referredByAffiliate,
              status: "active",
            }).select("user");
            if (aff && String(aff.user) !== String(est.owner)) {
              affiliateId = aff._id;
            }
          }
        }

        sub = await Subscription.findOneAndUpdate(
          { establishment: est._id },
          {
            $set: {
              establishment: est._id,
              owner: est.owner,
              planId: plan.id,
              billingCycle: cycle,
              priceCents: priceForCycle(plan, cycle),
              status: "trialing",
              trialEndsAt: end,
              currentPeriodEnd: end,
              providerSubscriptionId: "",
              cancelAtPeriodEnd: false,
              canceledAt: null,
              couponCode: coupon.code,
              discountPercent: 0,
              discountChargesLeft: 0,
              affiliate: affiliateId,
              affiliateWalletId: "",
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      }
    } catch (e) {
      await releaseCoupon(coupon, est.owner);
      console.error("redeemCoupon (gratis):", (e as Error).message);
      res.status(500).json({ message: "Não foi possível aplicar o cupom." });
      return;
    }

    res.json({
      subscription: sub,
      message: `Cupom aplicado: ${describeCoupon(coupon)}.`,
    });
  } catch (err) {
    console.error("redeemCoupon:", err);
    res.status(500).json({ message: "Erro ao aplicar o cupom" });
  }
};
