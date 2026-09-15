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

const base = "/subscriptions";

export const subscriptionApi = {
  plans: () => api.get<{ plans: Plan[] }>(`${base}/plans`).then((r) => r.data.plans),

  get: (establishmentId: string) =>
    api
      .get<{ subscription: Subscription | null }>(`${base}/${establishmentId}`)
      .then((r) => r.data.subscription),

  subscribe: (establishmentId: string, payload: SubscribePayload) =>
    api
      .post<{ subscription: Subscription; checkoutUrl: string | null }>(
        `${base}/${establishmentId}`,
        payload
      )
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

  // status leve (dono ou membro) — usado pelo paywall do painel
  status: (establishmentId: string) =>
    api
      .get<SubStatusInfo>(`${base}/${establishmentId}/status`)
      .then((r) => r.data),
};
