import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Establishment } from "../models/Establishment";
import { User } from "../models/User";
import { Subscription } from "../models/Subscription";
import { Booking } from "../models/Booking";
import {
  finalizeDepositPaid,
  finalizeServicePaid,
} from "./bookingController";
import { getPaymentProvider } from "../services/payments";
import { PLANS, getPlan, priceForCycle } from "../config/plans";
import { paymentsConfigured } from "../config/env";

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
    } = req.body as {
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
    if (
      existing &&
      (existing.status === "active" || existing.status === "trialing")
    ) {
      res.status(409).json({
        message: existing.cancelAtPeriodEnd
          ? "Sua assinatura está ativa até o fim do período. Use Reativar em vez de assinar de novo."
          : "Você já tem uma assinatura ativa.",
      });
      return;
    }

    const owner = await User.findById(est.owner).select("name email");
    if (!owner) {
      res.status(400).json({ message: "Dono nao encontrado" });
      return;
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

    const result = await provider.createSubscription({
      customerId,
      planId: plan.id,
      priceCents,
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
      remoteIp: req.ip,
      externalRef: est._id.toString(),
    });

    const data = {
      establishment: est._id,
      owner: est.owner,
      planId: plan.id,
      billingCycle,
      priceCents,
      status: result.status,
      provider: provider.name,
      providerCustomerId: customerId,
      providerSubscriptionId: result.subscriptionId,
      currentPeriodEnd: result.currentPeriodEnd,
      cardLast4: result.cardLast4 || "",
      cardBrand: result.cardBrand || "",
    };

    sub = await Subscription.findOneAndUpdate(
      { establishment: est._id },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      subscription: sub,
      checkoutUrl: result.checkoutUrl ?? null,
      pixQrImage: result.pixQrImage ?? null,
      pixCopiaECola: result.pixCopiaECola ?? null,
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
      if (info) {
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

    if (event.type === "payment_confirmed") {
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

    res.json({ ok: true });
  } catch (err) {
    console.error("paymentsWebhook:", err);
    // 200 mesmo em erro interno evita retry infinito; logamos para investigar
    res.status(200).json({ ok: false });
  }
};
