import {
  PaymentProvider,
  CreateCustomerInput,
  CreateSubaccountInput,
  CreatePixChargeInput,
  CreateChargeInput,
  CreateSubscriptionInput,
  SubscriptionResult,
  NormalizedEvent,
} from "./types";

// Adapter NO-OP: usado enquanto nenhum gateway esta configurado (dev).
// Nada de rede; devolve uma assinatura "active" para NAO bloquear o
// desenvolvimento. Em producao, configure um gateway real (PAYMENTS_PROVIDER).
export const noopProvider: PaymentProvider = {
  name: "noop",

  async createSubaccount(_input: CreateSubaccountInput) {
    return {
      accountId: "noop-account",
      walletId: "noop-wallet",
      apiKey: "noop-key",
    };
  },

  async findSubaccount(_cpfCnpj: string) {
    return null;
  },

  async createCustomer(_input: CreateCustomerInput) {
    return { customerId: "noop-customer" };
  },

  async createPixCharge(_input: CreatePixChargeInput) {
    return { paymentId: "noop-charge", checkoutUrl: null };
  },

  async createCharge(input: CreateChargeInput) {
    // dev: cartao confirma na hora; pix fica pendente (poll marca depois)
    return {
      paymentId: "noop-charge",
      checkoutUrl: null,
      status:
        input.billingType === "cartao"
          ? ("confirmed" as const)
          : ("pending" as const),
    };
  },

  async getChargeStatus(_paymentId: string, _apiKey?: string) {
    // dev: considera pago na hora para nao travar o fluxo local
    return { status: "confirmed" as const, checkoutUrl: null };
  },

  async createSubscription(
    _input: CreateSubscriptionInput
  ): Promise<SubscriptionResult> {
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    return {
      subscriptionId: "noop-subscription",
      status: "active",
      currentPeriodEnd: end,
      checkoutUrl: null,
    };
  },

  async updateSubscriptionValue(_subscriptionId: string, _newValueCents: number) {
    // no-op
  },

  async cancelSubscription(_subscriptionId: string, _endDate?: Date) {
    // no-op
  },

  async reactivateSubscription(_subscriptionId: string, _nextDueDate: Date) {
    // no-op
  },

  async getBalance(_apiKey: string) {
    // dev: saldo ficticio para nao travar o fluxo local
    return { balanceCents: 0 };
  },

  async transferPix(
    _apiKey: string,
    _input: { valueCents: number; pixKey: string }
  ) {
    // dev: finge que a transferencia foi feita
    return { transferId: "noop-transfer", status: "PENDING" };
  },

  async listConfirmedPayments(_subscriptionId: string) {
    // dev: sem gateway real, nada a reconciliar
    return [];
  },

  verifyWebhook() {
    return true;
  },

  parseWebhook(_body: unknown): NormalizedEvent | null {
    return null;
  },

  async fetchStatus() {
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    return { status: "active" as const, currentPeriodEnd: end };
  },
};
