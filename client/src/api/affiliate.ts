import { api } from "../lib/api";

// Conta de afiliado/representante (shape publico devolvido pela API)
export interface Affiliate {
  id: string;
  code: string;
  link: string; // vazio enquanto a conta Asaas nao for aprovada
  approved: boolean; // conta Asaas aprovada? so entao libera link e split
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
  monthlyEstimateCents: number;
  perPaymentEstimateCents: number;
  receivedTotalCents: number;
  receivedMonthCents: number;
}

export interface AffiliateWallet {
  balanceCents: number;
  balanceAvailable: boolean;
  hasAccount: boolean;
  canReadBalance: boolean;
  asaasLoginUrl: string;
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
