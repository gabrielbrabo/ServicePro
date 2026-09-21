import { Schema, model, Document, Types } from "mongoose";

// Assinatura do SaaS: UMA por estabelecimento (o dono paga o ServiçosPro).
// Os campos provider* guardam os IDs do gateway escolhido, para reconciliar
// os webhooks. status e a fonte da verdade para liberar/bloquear recursos.
export type SubscriptionStatus =
  | "none" // nunca assinou
  | "trialing" // periodo de teste
  | "active" // em dia
  | "past_due" // pagamento atrasado (em cobranca/dunning)
  | "canceled"; // cancelada

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  establishment: Types.ObjectId;
  owner: Types.ObjectId;
  planId: string;
  billingCycle: "mensal" | "anual";
  priceCents: number;
  // assentos de funcionario pagos alem dos 5 incluidos no plano
  extraSeats: number;
  // compra de assento pendente (PIX): cobranca a confirmar e alvo de assentos
  seatPendingPaymentId: string;
  seatPendingExtra: number;
  // espacos de galeria (armazenamento) pagos alem do incluido, + pendencia PIX
  extraGallerySlots: number;
  galleryPendingPaymentId: string;
  galleryPendingSlots: number;
  status: SubscriptionStatus;
  // afiliado/representante que indicou o dono: recebe split (25%) desta
  // assinatura. affiliateWalletId = a subconta Asaas que recebe o split.
  affiliate: Types.ObjectId | null;
  affiliateWalletId: string;
  // gateway
  provider: string; // "asaas" | "mercadopago" | "" (noop/dev)
  providerCustomerId: string;
  providerSubscriptionId: string;
  // datas do ciclo
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  // cancelamento agendado: para de renovar, mas mantem acesso ate currentPeriodEnd
  cancelAtPeriodEnd: boolean;
  // cartao salvo (exibicao) — a tokenizacao/cobranca recorrente fica no gateway
  cardLast4: string;
  cardBrand: string;
  // ultimo evento de webhook aplicado (auditoria/idempotencia leve)
  lastEventId: string;
  lastEventAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
      unique: true, // uma assinatura por estabelecimento
    },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: String, required: true },
    billingCycle: {
      type: String,
      enum: ["mensal", "anual"],
      default: "mensal",
    },
    priceCents: { type: Number, required: true, min: 0 },
    extraSeats: { type: Number, default: 0, min: 0 },
    seatPendingPaymentId: { type: String, default: "" },
    seatPendingExtra: { type: Number, default: 0, min: 0 },
    extraGallerySlots: { type: Number, default: 0, min: 0 },
    galleryPendingPaymentId: { type: String, default: "" },
    galleryPendingSlots: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["none", "trialing", "active", "past_due", "canceled"],
      default: "none",
      index: true,
    },
    // afiliado/representante (indicacao) — split de 25% desta assinatura
    affiliate: {
      type: Schema.Types.ObjectId,
      ref: "Affiliate",
      default: null,
      index: true,
    },
    affiliateWalletId: { type: String, default: "" },
    provider: { type: String, default: "" },
    providerCustomerId: { type: String, default: "", index: true },
    providerSubscriptionId: { type: String, default: "", index: true },
    trialEndsAt: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cardLast4: { type: String, default: "" },
    cardBrand: { type: String, default: "" },
    lastEventId: { type: String, default: "" },
    lastEventAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Subscription = model<ISubscription>(
  "Subscription",
  subscriptionSchema
);
