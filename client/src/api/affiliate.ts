import { api } from "../lib/api";

// Conta de afiliado/representante (shape publico devolvido pela API)
export interface Affiliate {
  id: string;
  code: string;
  link: string;
  status: "active" | "suspended";
  commissionPercent: number;
}

// Um indicado (assinatura de estabelecimento trazida pelo afiliado)
export interface AffiliateReferral {
  subscriptionId: string;
  establishmentId: string;
  establishmentName: string;
  establishmentPhoto?: string | null;
  planId: string;
  planName: string;
  billingCycle: "mensal" | "anual";
  priceCents: number;
  status: string;
  commissionPercent: number;
  commissionCents: number;
  currentPeriodEnd?: string | null;
}

export interface AffiliateSummary {
  total: number;
  active: number;
  commissionPercent: number;
  // previsto (a partir das assinaturas ativas)
  monthlyEstimateCents: number;
  perPaymentEstimateCents: number;
  // recebido de verdade (ledger de comissoes confirmadas)
  receivedTotalCents: number;
  receivedMonthCents: number;
}

export interface AffiliateWallet {
  balanceCents: number;
  balanceAvailable: boolean; // o saldo foi consultado com sucesso no Asaas
  hasAccount: boolean; // a subconta ja tem carteira
  canReadBalance: boolean; // temos a apiKey da subconta para ler o saldo
  asaasLoginUrl: string; // onde o afiliado saca (painel do Asaas)
  freeWithdrawalsPerMonth: number | null;
}

interface AffiliateAuthResponse {
  token: string;
  affiliate: Affiliate;
}

interface AffiliateReferralsResponse {
  affiliate: Affiliate;
  summary: AffiliateSummary;
  referrals: AffiliateReferral[];
}

export const affiliateApi = {
  register: (data: {
    name?: string;
    email?: string;
    password?: string;
    phone: string;
    cpfCnpj: string;
    birthDate?: string;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    province?: string;
    incomeValue?: number;
  }) =>
    api
      .post<AffiliateAuthResponse>("/affiliates/register", data)
      .then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    api
      .post<AffiliateAuthResponse>("/affiliates/login", data)
      .then((r) => r.data),

  me: () =>
    api
      .get<{ affiliate: Affiliate }>("/affiliates/me")
      .then((r) => r.data.affiliate),

  referrals: () =>
    api
      .get<AffiliateReferralsResponse>("/affiliates/me/referrals")
      .then((r) => r.data),

  wallet: () =>
    api.get<AffiliateWallet>("/affiliates/me/wallet").then((r) => r.data),
};
