import { api } from "../lib/api";

export interface Plan {
  id: string;
  name: string;
  monthlyCents: number;
  description?: string;
}

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export interface Subscription {
  _id: string;
  establishment: string;
  planId: string;
  billingCycle: "mensal" | "anual";
  priceCents: number;
  status: SubscriptionStatus;
  provider: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd?: boolean;
  cardLast4?: string;
  cardBrand?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscribePayload {
  planId: string;
  billingCycle: "mensal" | "anual";
  method: "pix" | "boleto" | "cartao";
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
}

export interface SubStatusInfo {
  status: SubscriptionStatus;
  entitled: boolean;
  paymentsEnabled: boolean;
  isOwner: boolean;
}

// situacao dos assentos de funcionario (equipe alem dos 5 incluidos)
export interface SeatStatus {
  used: number;
  includedSeats: number;
  extraSeats: number;
  max: number;
  canAdd: boolean;
  billingCycle: "mensal" | "anual";
  nextSeatPriceCents: number;
  nextSeatChargeNowCents: number;
  pending: boolean;
  hasSubscription: boolean;
}

export interface BuySeatPayload {
  method: "pix" | "cartao";
  cpfCnpj?: string;
  card?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  holderInfo?: { postalCode: string; addressNumber: string; phone: string };
}

export interface BuySeatResult {
  granted: boolean;
  extraSeats?: number;
  paymentId?: string;
  pixQrImage?: string | null;
  pixCopiaECola?: string | null;
  chargeNowCents?: number;
}

// espaco de galeria (armazenamento): single=1, antes/depois=2
export interface GallerySpace {
  used: number;
  singles: number;
  bas: number;
  includedSlots: number;
  extraSlots: number;
  max: number;
  remaining: number;
  billingCycle: "mensal" | "anual";
  packSlots: number;
  packPriceCents: number;
  packChargeNowCents: number;
  pending: boolean;
  hasSubscription: boolean;
}

export interface BuyGalleryResult {
  granted: boolean;
  extraSlots?: number;
  paymentId?: string;
  pixQrImage?: string | null;
  pixCopiaECola?: string | null;
  chargeNowCents?: number;
}

const base = "/subscriptions";

export const subscriptionApi = {
  plans: () => api.get<{ plans: Plan[] }>(`${base}/plans`).then((r) => r.data.plans),

  get: (establishmentId: string) =>
    api
      .get<{ subscription: Subscription | null }>(`${base}/${establishmentId}`)
      .then((r) => r.data.subscription),

  subscribe: (establishmentId: string, payload: SubscribePayload) =>
    api
      .post<{
        subscription: Subscription;
        checkoutUrl: string | null;
        pixQrImage?: string | null;
        pixCopiaECola?: string | null;
      }>(`${base}/${establishmentId}`, payload)
      .then((r) => r.data),

  cancel: (establishmentId: string) =>
    api
      .post<{ subscription: Subscription }>(`${base}/${establishmentId}/cancel`)
      .then((r) => r.data.subscription),

  reactivate: (establishmentId: string) =>
    api
      .post<{ subscription: Subscription }>(
        `${base}/${establishmentId}/reactivate`
      )
      .then((r) => r.data.subscription),

  // consulta o status direto no gateway (confirma pagamento sem webhook)
  refresh: (establishmentId: string) =>
    api
      .post<{ subscription: Subscription }>(`${base}/${establishmentId}/refresh`)
      .then((r) => r.data.subscription),

  // QR/copia-e-cola do PIX da cobranca pendente (mostrar no painel)
  pix: (establishmentId: string) =>
    api
      .get<{
        pixQrImage: string | null;
        pixCopiaECola: string | null;
        checkoutUrl: string | null;
      }>(`${base}/${establishmentId}/pix`)
      .then((r) => r.data),

  // status leve (dono ou membro) — usado pelo paywall do painel
  status: (establishmentId: string) =>
    api
      .get<SubStatusInfo>(`${base}/${establishmentId}/status`)
      .then((r) => r.data),

  // situacao dos assentos de funcionario (dono)
  seats: (establishmentId: string) =>
    api
      .get<SeatStatus>(`${base}/${establishmentId}/seats`)
      .then((r) => r.data),

  // compra 1 assento extra (dono). PIX devolve QR; cartao concede na hora.
  buySeat: (establishmentId: string, payload: BuySeatPayload) =>
    api
      .post<BuySeatResult>(`${base}/${establishmentId}/seats`, payload)
      .then((r) => r.data),

  // situacao do espaco de galeria (dono)
  gallery: (establishmentId: string) =>
    api
      .get<GallerySpace>(`${base}/${establishmentId}/gallery`)
      .then((r) => r.data),

  // compra 1 pacote de espaco (dono). PIX devolve QR; cartao concede na hora.
  buyGallery: (establishmentId: string, payload: BuySeatPayload) =>
    api
      .post<BuyGalleryResult>(`${base}/${establishmentId}/gallery`, payload)
      .then((r) => r.data),
};
