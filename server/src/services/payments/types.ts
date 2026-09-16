// Contrato do gateway de pagamento. TODA parte especifica de um gateway fica
// atras desta interface, num unico arquivo (ex.: asaas.ts). Trocar/adicionar
// gateway = escrever um novo adapter; o resto do sistema nao muda.

// dados para criar a subconta Asaas do estabelecimento (recebimentos/split)
export interface CreateSubaccountInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number; // faturamento/renda mensal (R$)
  address: string;
  addressNumber: string;
  province: string; // bairro
  postalCode: string; // CEP
  birthDate?: string; // pessoa fisica (YYYY-MM-DD)
  companyType?: string; // pessoa juridica
}

// cobranca avulsa (PIX) do CLIENTE para o estabelecimento, com split 100%
// para a subconta do estabelecimento (walletId).
export interface CreatePixChargeInput {
  customerName: string;
  customerEmail: string;
  customerCpfCnpj: string;
  valueCents: number;
  description: string;
  externalReference: string; // ex.: "booking:<id>"
  splitWalletId: string;
}

// cobranca avulsa do CLIENTE para o estabelecimento (sinal OU serviço), com
// split 100% para a subconta do estabelecimento. Suporta PIX e cartao.
export interface CreateChargeInput {
  billingType: "pix" | "cartao";
  customerName: string;
  customerEmail: string;
  customerCpfCnpj: string;
  valueCents: number;
  description: string;
  externalReference: string; // ex.: "booking:<id>" | "booking-service:<id>"
  splitWalletId: string;
  // se informada, cria a cobranca DIRETO na subconta do estabelecimento (sem
  // split, empresa fora do fluxo). Sem ela, usa split na conta principal.
  subaccountApiKey?: string;
  // cartao salvo: reusa um cliente + token de cartao ja existentes (na conta
  // principal), para o cliente nao digitar o cartao de novo.
  customerId?: string; // cliente reutilizavel (conta principal)
  cardToken?: string; // token do cartao salvo (cobra sem pedir os dados)
  // dados do cartao (billingType === "cartao"); cobra na hora
  card?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  holderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp?: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  externalRef?: string; // id do establishment/owner do nosso lado
}

export interface CreateSubscriptionInput {
  customerId: string;
  planId: string;
  priceCents: number;
  billingCycle: "mensal" | "anual";
  method: "pix" | "cartao" | "boleto";
  // token do cartao (tokenizado no front) quando method === "cartao"
  cardToken?: string;
  // dados do cartao digitados no app (method === "cartao", sem token)
  card?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  // dados do titular exigidos pelo gateway na cobranca por cartao
  holderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp?: string;
  externalRef?: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: Date | null;
  // link de pagamento/checkout quando o gateway exige (ex.: PIX/boleto)
  checkoutUrl?: string | null;
  // PIX: imagem do QR (data URI) e copia-e-cola, para exibir no app
  pixQrImage?: string | null;
  pixCopiaECola?: string | null;
  // cartao salvo (quando pago no cartao)
  cardLast4?: string;
  cardBrand?: string;
}

// Evento de webhook ja NORMALIZADO (cada adapter traduz o payload do seu
// gateway para este formato comum).
export interface NormalizedEvent {
  id: string; // id do evento (idempotencia)
  type:
    | "payment_confirmed" // pagou -> ativa/renova
    | "payment_overdue" // atrasou -> past_due
    | "subscription_canceled"
    | "unknown";
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  currentPeriodEnd?: Date | null;
  // para cobrancas avulsas (sinal/serviço do cliente)
  externalReference?: string; // ex.: "booking:<id>"
  paymentId?: string;
}

export interface PaymentProvider {
  readonly name: string;
  // cria a subconta do estabelecimento (recebimentos via split). Retorna o
  // walletId usado no split das cobrancas do cliente.
  createSubaccount?(
    input: CreateSubaccountInput
  ): Promise<{ accountId: string; walletId: string; apiKey: string }>;
  // procura subconta existente pelo CPF/CNPJ (reaproveitar em vez de recriar)
  findSubaccount?(
    cpfCnpj: string
  ): Promise<{ accountId: string; walletId: string } | null>;
  createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }>;
  // cobranca avulsa PIX do cliente com split 100% para o estabelecimento
  createPixCharge?(
    input: CreatePixChargeInput
  ): Promise<{ paymentId: string; checkoutUrl: string | null }>;
  // cobranca avulsa (PIX ou cartao) do cliente com split. No cartao a cobranca
  // e capturada na hora (status "confirmed"); no PIX fica "pending" ate pagar.
  createCharge?(input: CreateChargeInput): Promise<{
    paymentId: string;
    checkoutUrl: string | null;
    status: "confirmed" | "pending";
    pixQrImage?: string | null;
    pixCopiaECola?: string | null;
    // cartao: cliente + token para salvar e reusar depois
    customerId?: string;
    cardToken?: string;
    cardLast4?: string;
    cardBrand?: string;
  }>;
  // consulta o status de UMA cobranca avulsa direto no gateway (fallback quando
  // o webhook nao chega — ex.: testar sem URL publica). "confirmed" = pago.
  // apiKey: quando a cobranca foi criada na subconta, consulta com a chave dela
  getChargeStatus?(
    paymentId: string,
    apiKey?: string
  ): Promise<{
    status: "confirmed" | "pending" | "canceled";
    checkoutUrl?: string | null; // link/QR atual (reaproveitar cobranca PIX)
  }>;
  createSubscription(
    input: CreateSubscriptionInput
  ): Promise<SubscriptionResult>;
  // QR/copia-e-cola do PIX da cobranca pendente de uma assinatura (para exibir
  // no painel quando a assinatura foi criada em outra tela). Opcional.
  getSubscriptionPix?(subscriptionId: string): Promise<{
    image: string | null;
    payload: string | null;
    checkoutUrl: string | null;
  }>;
  // cancela no fim do periodo (endDate) ou de vez (sem data)
  cancelSubscription(subscriptionId: string, endDate?: Date): Promise<void>;
  // reativa uma assinatura cancelada, com a proxima cobranca em nextDueDate
  reactivateSubscription?(
    subscriptionId: string,
    nextDueDate: Date
  ): Promise<void>;
  // valida que o webhook veio mesmo do gateway (header/assinatura)
  verifyWebhook(rawBody: Buffer | undefined, headers: NodeJS.Dict<string | string[]>): boolean;
  // traduz o payload cru para o evento normalizado (null = ignorar)
  parseWebhook(body: unknown): NormalizedEvent | null;
  // consulta o status atual DIRETO no gateway (fallback quando o webhook nao
  // chega — ex.: testar sem ngrok). Opcional.
  fetchStatus?(subscriptionId: string): Promise<{
    status: "active" | "past_due" | "canceled";
    currentPeriodEnd: Date | null;
  } | null>;
}
