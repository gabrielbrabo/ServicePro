import { env } from "../../config/env";
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

// Adapter do Asaas (https://docs.asaas.com).
// - API: header "access_token: <chave>", base sandbox api-sandbox.asaas.com/v3
// - Webhook: Asaas manda o token no header "asaas-access-token" (comparamos
//   com PAYMENTS_WEBHOOK_SECRET) e o valor vem em REAIS (nao centavos).
//
// Usa o fetch global do Node (>=18). Tipado como any para nao depender das libs
// de DOM no tsconfig do server.
const doFetch: (url: string, init?: unknown) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<Record<string, unknown>>;
}> = (globalThis as unknown as { fetch: typeof doFetch }).fetch;

const cents = (v: number) => Math.round(v) / 100; // centavos -> reais

// Date -> YYYY-MM-DD
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// data de hoje em YYYY-MM-DD (server roda com TZ=America/Sao_Paulo)
function today(): string {
  return ymd(new Date());
}

// fim do periodo atual = hoje + 1 ciclo (proxima cobranca)
function periodEnd(cycle: "mensal" | "anual"): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + (cycle === "anual" ? 12 : 1));
  return d;
}

async function api(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
  apiKeyOverride?: string
): Promise<Record<string, unknown>> {
  const res = await doFetch(`${env.payments.asaas.baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      // com override, opera na SUBCONTA (cobranca do cliente); sem, na conta
      // principal (assinaturas da plataforma)
      access_token: apiKeyOverride || env.payments.asaas.apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg =
      (data?.errors as { description?: string }[] | undefined)?.[0]
        ?.description || `Asaas ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

const billingTypeMap: Record<string, string> = {
  pix: "PIX",
  cartao: "CREDIT_CARD",
  boleto: "BOLETO",
};

// busca o QR Code PIX (imagem base64 + copia-e-cola) de uma cobranca. Assim o
// app mostra o PIX de verdade, em vez de abrir a fatura (que pode exibir boleto).
async function pixQr(
  paymentId: string,
  apiKey?: string
): Promise<{ image: string | null; payload: string | null }> {
  try {
    const q = await api(`/payments/${paymentId}/pixQrCode`, "GET", undefined, apiKey);
    const encoded = q.encodedImage as string | undefined;
    return {
      image: encoded ? `data:image/png;base64,${encoded}` : null,
      payload: (q.payload as string) || null,
    };
  } catch {
    return { image: null, payload: null };
  }
}

export const asaasProvider: PaymentProvider = {
  name: "asaas",

  // procura uma subconta ja existente pelo CPF/CNPJ (evita "documento/e-mail
  // ja em uso" quando o dono ja tem conta criada por outro estabelecimento)
  async findSubaccount(cpfCnpj: string) {
    const data = await api(
      `/accounts?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
      "GET"
    );
    const first = (
      data.data as { id?: string; walletId?: string }[] | undefined
    )?.[0];
    if (!first?.walletId) return null;
    return {
      accountId: String(first.id ?? ""),
      walletId: String(first.walletId ?? ""),
    };
  },

  // cria a subconta do estabelecimento (POST /accounts) e devolve o walletId
  async createSubaccount(input: CreateSubaccountInput) {
    const data = await api("/accounts", "POST", {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      mobilePhone: input.mobilePhone,
      incomeValue: input.incomeValue,
      address: input.address,
      addressNumber: input.addressNumber,
      province: input.province,
      postalCode: input.postalCode,
      birthDate: input.birthDate,
      companyType: input.companyType,
    });
    return {
      accountId: String(data.id ?? ""),
      walletId: String(data.walletId ?? ""),
      // chave de API da subconta — o Asaas so devolve UMA vez, na criacao.
      // Guardamos para cobrar direto na subconta depois.
      apiKey: String(data.apiKey ?? ""),
    };
  },

  async createCustomer(input: CreateCustomerInput) {
    const data = await api("/customers", "POST", {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      mobilePhone: input.phone,
      externalReference: input.externalRef,
      // o app manda as proprias notificacoes/e-mails -> desliga as do Asaas
      // (evita a "taxa de mensageria" cobrada por notificacao enviada)
      notificationDisabled: true,
    });
    return { customerId: String(data.id) };
  },

  // cobranca PIX avulsa do cliente com split 100% para o estabelecimento
  async createPixCharge(input: CreatePixChargeInput) {
    // so envia o email se for valido; o Asaas rejeita ("email invalido")
    // um email vazio/mal formado, e o email nao e obrigatorio p/ o cliente.
    const email = (input.customerEmail || "").trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const c = await api("/customers", "POST", {
      name: input.customerName,
      cpfCnpj: input.customerCpfCnpj,
      ...(validEmail ? { email } : {}),
    });
    const pay = await api("/payments", "POST", {
      customer: String(c.id),
      billingType: "PIX",
      value: cents(input.valueCents),
      dueDate: today(),
      description: input.description,
      externalReference: input.externalReference,
      split: [{ walletId: input.splitWalletId, percentualValue: 100 }],
    });
    return {
      paymentId: String(pay.id ?? ""),
      checkoutUrl: (pay.invoiceUrl as string) || null,
    };
  },

  // cobranca avulsa do cliente (sinal ou serviço). PIX ou cartao.
  // Se vier subaccountApiKey, cria DIRETO na subconta do estabelecimento (sem
  // split, empresa fora). Senao, cai no split 100% na conta principal (legado).
  async createCharge(input: CreateChargeInput) {
    const sub = input.subaccountApiKey || undefined;
    const email = (input.customerEmail || "").trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // reusa o cliente ja salvo (cartao salvo) ou cria um novo
    let customerId = input.customerId || "";
    if (!customerId) {
      const c = await api(
        "/customers",
        "POST",
        {
          name: input.customerName,
          cpfCnpj: input.customerCpfCnpj,
          ...(validEmail ? { email } : {}),
          // desliga as notificacoes do Asaas (o app ja notifica) -> sem taxa
          // de mensageria, que era o que descontava da conta
          notificationDisabled: true,
        },
        sub
      );
      customerId = String(c.id);
    }

    const isCard = input.billingType === "cartao";
    const body: Record<string, unknown> = {
      customer: customerId,
      billingType: isCard ? "CREDIT_CARD" : "PIX",
      value: cents(input.valueCents),
      dueDate: today(),
      description: input.description,
      externalReference: input.externalReference,
    };
    // split só quando NÃO é direto na subconta E NÃO é cobranca da plataforma.
    // Cobranca da plataforma (assento) fica 100% na conta principal, sem split.
    if (!sub && !input.platform) {
      body.split = [{ walletId: input.splitWalletId, percentualValue: 100 }];
    }
    if (isCard) {
      if (input.cardToken) {
        // cartao salvo: cobra pelo token, sem pedir os dados de novo
        body.creditCardToken = input.cardToken;
      } else if (input.card && input.holderInfo) {
        body.creditCard = {
          holderName: input.card.holderName,
          number: input.card.number,
          expiryMonth: input.card.expiryMonth,
          expiryYear: input.card.expiryYear,
          ccv: input.card.ccv,
        };
        body.creditCardHolderInfo = {
          name: input.holderInfo.name,
          email: input.holderInfo.email,
          cpfCnpj: input.holderInfo.cpfCnpj,
          postalCode: input.holderInfo.postalCode,
          addressNumber: input.holderInfo.addressNumber,
          phone: input.holderInfo.phone,
        };
      }
      if (input.remoteIp) body.remoteIp = input.remoteIp;
    }

    const pay = await api("/payments", "POST", body, sub);
    const s = String(pay.status || "");
    const confirmed =
      s === "CONFIRMED" || s === "RECEIVED" || s === "RECEIVED_IN_CASH";
    // PIX: busca o QR/copia-e-cola para exibir no app (nao usa a fatura/boleto)
    const qr = isCard
      ? { image: null, payload: null }
      : await pixQr(String(pay.id ?? ""), sub);
    // cartao: token/final/bandeira para salvar e reusar depois
    const cc = pay.creditCard as
      | { creditCardToken?: string; creditCardNumber?: string; creditCardBrand?: string }
      | undefined;
    return {
      paymentId: String(pay.id ?? ""),
      checkoutUrl: (pay.invoiceUrl as string) || null,
      status: confirmed ? ("confirmed" as const) : ("pending" as const),
      pixQrImage: qr.image,
      pixCopiaECola: qr.payload,
      customerId,
      cardToken: cc?.creditCardToken || input.cardToken || undefined,
      cardLast4: cc?.creditCardNumber || undefined,
      cardBrand: cc?.creditCardBrand || undefined,
    };
  },

  // consulta o status de uma cobranca avulsa (sinal/serviço) direto no Asaas.
  // apiKey: quando a cobranca esta na subconta, consulta com a chave dela.
  async getChargeStatus(paymentId: string, apiKey?: string) {
    const p = await api(`/payments/${paymentId}`, "GET", undefined, apiKey);
    const s = String(p.status || "");
    const checkoutUrl = (p.invoiceUrl as string) || null;
    if (s === "CONFIRMED" || s === "RECEIVED" || s === "RECEIVED_IN_CASH") {
      return { status: "confirmed" as const, checkoutUrl };
    }
    if (s === "REFUNDED" || s === "DELETED" || s === "CANCELED") {
      return { status: "canceled" as const, checkoutUrl };
    }
    return { status: "pending" as const, checkoutUrl };
  },

  async createSubscription(
    input: CreateSubscriptionInput
  ): Promise<SubscriptionResult> {
    const body: Record<string, unknown> = {
      customer: input.customerId,
      billingType: billingTypeMap[input.method] || "PIX",
      value: cents(input.priceCents),
      cycle: input.billingCycle === "anual" ? "YEARLY" : "MONTHLY",
      nextDueDate: today(),
      description: `Assinatura ServiçosPro (${input.planId})`,
      externalReference: input.externalRef,
    };
    const paidByCard =
      input.method === "cartao" && !!input.card && !!input.holderInfo;

    if (input.method === "cartao" && input.cardToken) {
      body.creditCardToken = input.cardToken;
    } else if (paidByCard) {
      // dados do cartao digitados no app -> cobra na hora
      body.creditCard = {
        holderName: input.card!.holderName,
        number: input.card!.number,
        expiryMonth: input.card!.expiryMonth,
        expiryYear: input.card!.expiryYear,
        ccv: input.card!.ccv,
      };
      body.creditCardHolderInfo = {
        name: input.holderInfo!.name,
        email: input.holderInfo!.email,
        cpfCnpj: input.holderInfo!.cpfCnpj,
        postalCode: input.holderInfo!.postalCode,
        addressNumber: input.holderInfo!.addressNumber,
        phone: input.holderInfo!.phone,
      };
      if (input.remoteIp) body.remoteIp = input.remoteIp;
    }

    const sub = await api("/subscriptions", "POST", body);
    const subscriptionId = String(sub.id);
    const end = periodEnd(input.billingCycle);

    // Cartao: se o Asaas aceitou (nao lancou erro), a 1a cobranca ja foi
    // capturada -> ativa na hora. O cartao fica salvo no Asaas p/ recorrencia.
    if (paidByCard) {
      const cc = sub.creditCard as
        | { creditCardNumber?: string; creditCardBrand?: string }
        | undefined;
      return {
        subscriptionId,
        status: "active",
        currentPeriodEnd: end,
        checkoutUrl: null,
        cardLast4: cc?.creditCardNumber || "",
        cardBrand: cc?.creditCardBrand || "",
      };
    }

    // PIX/boleto: fica pendente ate pagar; buscamos a cobranca gerada.
    let checkoutUrl: string | null = null;
    let pixQrImage: string | null = null;
    let pixCopiaECola: string | null = null;
    try {
      const pays = await api(
        `/subscriptions/${subscriptionId}/payments`,
        "GET"
      );
      const first = (
        pays.data as { id?: string; invoiceUrl?: string }[] | undefined
      )?.[0];
      checkoutUrl = first?.invoiceUrl || null;
      // PIX: pega o QR/copia-e-cola pra mostrar no app (evita a tela de boleto)
      if (input.method === "pix" && first?.id) {
        const qr = await pixQr(String(first.id));
        pixQrImage = qr.image;
        pixCopiaECola = qr.payload;
      }
    } catch {
      // sem link agora; o webhook/refresh confirma o pagamento depois
    }

    return {
      subscriptionId,
      status: "past_due", // aguardando 1o pagamento; webhook/refresh -> active
      currentPeriodEnd: end,
      checkoutUrl,
      pixQrImage,
      pixCopiaECola,
    };
  },

  // QR/copia-e-cola do PIX da cobranca pendente da assinatura
  async getSubscriptionPix(subscriptionId: string) {
    try {
      const pays = await api(
        `/subscriptions/${subscriptionId}/payments`,
        "GET"
      );
      const list =
        (pays.data as
          | { id?: string; status?: string; invoiceUrl?: string }[]
          | undefined) || [];
      // pega a cobranca ainda em aberto (pendente/atrasada)
      const pend =
        list.find((p) => p.status === "PENDING" || p.status === "OVERDUE") ||
        list[0];
      if (!pend?.id) return { image: null, payload: null, checkoutUrl: null };
      const qr = await pixQr(String(pend.id));
      return {
        image: qr.image,
        payload: qr.payload,
        checkoutUrl: pend.invoiceUrl || null,
      };
    } catch {
      return { image: null, payload: null, checkoutUrl: null };
    }
  },

  // Atualiza o valor recorrente da assinatura (ex.: somou assentos). Nao mexe
  // nas cobrancas ja geradas (updatePendingPayments:false).
  async updateSubscriptionValue(subscriptionId: string, newValueCents: number) {
    await api(`/subscriptions/${subscriptionId}`, "PUT", {
      value: cents(newValueCents),
      updatePendingPayments: false,
    });
  },

  // Cancela no FIM do periodo (endDate) mantendo o acesso ate la; sem data,
  // encerra de vez (DELETE).
  async cancelSubscription(subscriptionId: string, endDate?: Date) {
    if (endDate) {
      await api(`/subscriptions/${subscriptionId}`, "PUT", {
        endDate: ymd(endDate),
        updatePendingPayments: false,
      });
    } else {
      await api(`/subscriptions/${subscriptionId}`, "DELETE");
    }
  },

  // Reativa: volta a renovar, com a proxima cobranca so no fim do periodo atual
  // (nextDueDate futuro) — nao cobra de novo agora.
  async reactivateSubscription(subscriptionId: string, nextDueDate: Date) {
    await api(`/subscriptions/${subscriptionId}`, "PUT", {
      status: "ACTIVE",
      nextDueDate: ymd(nextDueDate),
      endDate: null,
    });
  },

  // consulta as cobrancas da assinatura no Asaas e deduz o status (sem webhook)
  async fetchStatus(subscriptionId: string) {
    const pays = await api(
      `/subscriptions/${subscriptionId}/payments`,
      "GET"
    );
    const list =
      (pays.data as { status?: string; dueDate?: string }[] | undefined) || [];

    const paid = list.find(
      (p) =>
        p.status === "CONFIRMED" ||
        p.status === "RECEIVED" ||
        p.status === "RECEIVED_IN_CASH"
    );
    if (paid) {
      // nao sobrescreve o fim do periodo (ja calculado na criacao = hoje+ciclo)
      return { status: "active" as const, currentPeriodEnd: null };
    }
    if (list.some((p) => p.status === "OVERDUE")) {
      return { status: "past_due" as const, currentPeriodEnd: null };
    }
    // ainda pendente
    return { status: "past_due" as const, currentPeriodEnd: null };
  },

  verifyWebhook(_rawBody, headers) {
    const token = headers["asaas-access-token"];
    const secret = env.payments.webhookSecret;
    // sem secret configurado, rejeita (evita webhook forjado)
    if (!secret) return false;
    return token === secret;
  },

  parseWebhook(body: unknown): NormalizedEvent | null {
    const b = body as {
      id?: string;
      event?: string;
      payment?: {
        id?: string;
        subscription?: string;
        customer?: string;
        dueDate?: string;
        externalReference?: string;
      };
      subscription?: string;
    };
    if (!b?.event) return null;

    const payment = b.payment;
    const subId = payment?.subscription || b.subscription;

    let type: NormalizedEvent["type"] = "unknown";
    if (b.event === "PAYMENT_CONFIRMED" || b.event === "PAYMENT_RECEIVED") {
      type = "payment_confirmed";
    } else if (b.event === "PAYMENT_OVERDUE") {
      type = "payment_overdue";
    } else if (
      b.event === "SUBSCRIPTION_DELETED" ||
      b.event === "SUBSCRIPTION_INACTIVATED"
    ) {
      type = "subscription_canceled";
    }

    if (type === "unknown") return null;

    return {
      id: b.id || `${b.event}:${payment?.id || subId || ""}`,
      type,
      providerSubscriptionId: subId,
      providerCustomerId: payment?.customer,
      currentPeriodEnd: payment?.dueDate
        ? new Date(payment.dueDate)
        : undefined,
      externalReference: payment?.externalReference,
      paymentId: payment?.id,
    };
  },
};
