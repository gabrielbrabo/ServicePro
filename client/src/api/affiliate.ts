import { api } from "../lib/api";

// Conta de afiliado/representante (shape publico devolvido pela API)
export interface Affiliate {
  id: string;
  code: string;
  // modelo antigo: vazio ate a conta Asaas ser aprovada. Modelo novo
  // (deferred): liberado na hora do cadastro.
  link: string;
  approved: boolean; // conta de recebimento (Asaas) aprovada?
  status: "active" | "suspended";
  commissionPercent: number;
  // "deferred" = conta de recebimento aberta so no 1o indicado pagante
  accountMode?: "upfront" | "deferred";
  accountOpened?: boolean; // subconta Asaas ja aberta?
  // o Asaas recusou abrir a conta (ex.: CEP invalido) — corrigir no painel
  accountOpenError?: string;
  // e-mail da conta de recebimento no Asaas ("" = o mesmo do login)
  asaasEmail?: string;
}

// dados da conta de recebimento (corrigiveis antes de a conta ser aberta)
export interface ReceivingData {
  cpfCnpj: string;
  phone: string;
  birthDate: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  // opcional: e-mail proprio para a conta de recebimento ("" = o do login)
  asaasEmail?: string;
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
  // comissoes guardadas ate a conta de recebimento ser aprovada
  pendingPayoutCents?: number;
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
    // aceite dos Termos de Uso + Politica de Privacidade
    acceptTerms?: boolean;
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

  receivingData: () =>
    api
      .get<ReceivingData & { editable: boolean; accountOpenError: string }>(
        "/affiliates/me/receiving-data"
      )
      .then((r) => r.data),

  updateReceivingData: (data: ReceivingData) =>
    api
      .put<{ saved: boolean; opened: boolean; accountOpenError: string }>(
        "/affiliates/me/receiving-data",
        data
      )
      .then((r) => r.data),

  // confere um link/codigo de indicacao (devolve o nome do afiliado)
  checkRef: (ref: string) =>
    api
      .get<{ valid: boolean; affiliateName?: string; code?: string }>(
        "/affiliates/check-ref",
        { params: { ref } }
      )
      .then((r) => r.data),

  // informa DEPOIS do cadastro quem indicou (uma unica vez)
  linkReferrer: (ref: string) =>
    api
      .post<{
        referred: boolean;
        affiliateName: string;
        code: string;
        subscriptionsLinked: number;
        splitsApplied: number;
      }>("/affiliates/my-referrer", { ref })
      .then((r) => r.data),

  // dono logado ja foi indicado por um afiliado? (para travar o campo no
  // cadastro de estabelecimento e mostrar por quem foi indicado)
  myReferrer: () =>
    api
      .get<{ referred: boolean; affiliateName?: string; code?: string }>(
        "/affiliates/my-referrer"
      )
      .then((r) => r.data),
};
