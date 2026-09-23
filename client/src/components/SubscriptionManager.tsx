import { useEffect, useState, useCallback } from "react";
import {
  subscriptionApi,
  Plan,
  Subscription,
  SubscribePayload,
} from "../api/subscription";
import { useAuth } from "../context/AuthContext";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const priceForCycle = (plan: Plan, cycle: "mensal" | "anual") =>
  cycle === "anual" ? plan.monthlyCents * 10 : plan.monthlyCents;

// vantagem do anual (mesma regra do back: paga 10 meses, usa 12)
const annualSavings = (plan: Plan) => {
  const fullYear = plan.monthlyCents * 12; // 12x o mensal
  const annual = priceForCycle(plan, "anual"); // o que paga no anual
  const saved = fullYear - annual;
  return {
    fullYear,
    annual,
    saved,
    perMonth: Math.round(annual / 12), // quanto "sai por mes" no anual
    percent: fullYear > 0 ? Math.round((saved / fullYear) * 100) : 0,
  };
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  active: { text: "Ativa", cls: "bg-teal-500/10 text-teal-700" },
  trialing: { text: "Em teste", cls: "bg-teal-500/10 text-teal-700" },
  past_due: { text: "Aguardando pagamento", cls: "bg-amber-400/15 text-amber-700" },
  canceled: { text: "Cancelada", cls: "bg-red-500/10 text-red-600" },
  none: { text: "Sem assinatura", cls: "bg-ink/5 text-ink/60" },
};

export function SubscriptionManager({
  establishment,
}: {
  establishment: {
    _id: string;
    billingCycle?: "mensal" | "anual";
    segment?: "geral" | "beleza" | "saude";
  };
}) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cycle, setCycle] = useState<"mensal" | "anual">(
    establishment.billingCycle || "mensal"
  );
  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [pixImage, setPixImage] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // dados do cartao (só quando method === "cartao")
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [cep, setCep] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");

  // o plano é a ÁREA do estabelecimento (fixo)
  const plan = plans.find((p) => p.id === establishment.segment) || null;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      subscriptionApi.plans(),
      subscriptionApi.get(establishment._id),
    ])
      .then(([pl, s]) => {
        setPlans(pl);
        setSub(s);
      })
      .catch(() => setError("Não foi possível carregar a assinatura."))
      .finally(() => setLoading(false));
  }, [establishment._id]);

  useEffect(load, [load]);

  // assinatura pendente (PIX) sem QR local (ex.: criada no cadastro): busca o
  // QR/copia-e-cola para exibir aqui no painel.
  useEffect(() => {
    if (sub?.status !== "past_due") return;
    if (pixImage || pixCode) return;
    subscriptionApi
      .pix(establishment._id)
      .then((p) => {
        setPixImage(p.pixQrImage);
        setPixCode(p.pixCopiaECola);
        if (p.checkoutUrl) setCheckoutUrl(p.checkoutUrl);
      })
      .catch(() => {});
  }, [sub?.status, pixImage, pixCode, establishment._id]);

  // PIX: enquanto o pagamento estiver pendente, verifica sozinho (sem clicar).
  // Assim que o cliente paga, o Asaas confirma e a tela libera automaticamente.
  useEffect(() => {
    if (sub?.status !== "past_due") return;
    let n = 0;
    const id = setInterval(async () => {
      n += 1;
      try {
        const s = await subscriptionApi.refresh(establishment._id);
        setSub(s);
        if (s.status === "active" || s.status === "trialing") {
          setCheckoutUrl(null);
          clearInterval(id);
        }
      } catch {
        /* ignora e tenta de novo */
      }
      if (n >= 40) clearInterval(id); // para depois de ~3min
    }, 5000);
    return () => clearInterval(id);
  }, [sub?.status, establishment._id]);

  const entitled =
    sub && (sub.status === "active" || sub.status === "trialing");

  const subscribe = async () => {
    if (!establishment.segment) {
      setError("Área do estabelecimento não definida.");
      return;
    }
    if (!cpfCnpj.trim()) {
      setError("Informe o CPF ou CNPJ do responsável pela cobrança.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Informe um e-mail válido para a cobrança.");
      return;
    }
    let card: SubscribePayload["card"];
    let holderInfo: SubscribePayload["holderInfo"];
    if (method === "cartao") {
      const m = cardExpiry.trim().match(/^(\d{2})\s*\/\s*(\d{2,4})$/);
      if (
        !cardHolder.trim() ||
        cardNumber.replace(/\s/g, "").length < 12 ||
        !m ||
        cardCcv.trim().length < 3
      ) {
        setError("Preencha os dados do cartão (validade no formato MM/AA).");
        return;
      }
      if (!cep.trim() || !addressNumber.trim() || !phone.trim()) {
        setError("Preencha CEP, número do endereço e telefone do titular.");
        return;
      }
      card = {
        holderName: cardHolder.trim(),
        number: cardNumber.replace(/\s/g, ""),
        expiryMonth: m[1],
        expiryYear: m[2].length === 2 ? "20" + m[2] : m[2],
        ccv: cardCcv.trim(),
      };
      holderInfo = {
        postalCode: cep.replace(/\D/g, ""),
        addressNumber: addressNumber.trim(),
        phone: phone.replace(/\D/g, ""),
      };
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: SubscribePayload = {
        planId: establishment.segment,
        billingCycle: cycle,
        method,
        cpfCnpj: cpfCnpj.trim(),
        email: email.trim(),
        card,
        holderInfo,
      };
      const res = await subscriptionApi.subscribe(establishment._id, payload);
      setSub(res.subscription);
      setCheckoutUrl(res.checkoutUrl);
      setPixImage(res.pixQrImage || null);
      setPixCode(res.pixCopiaECola || null);
      // nao abre a fatura (pode mostrar boleto); o PIX aparece aqui mesmo
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Não foi possível criar a assinatura.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const s = await subscriptionApi.refresh(establishment._id);
      setSub(s);
      if (s.status === "active" || s.status === "trialing") setCheckoutUrl(null);
    } catch {
      setError("Não foi possível atualizar o status.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const s = await subscriptionApi.cancel(establishment._id);
      setSub(s);
      setCheckoutUrl(null);
      setConfirmingCancel(false);
    } catch {
      setError("Não foi possível cancelar.");
    } finally {
      setSubmitting(false);
    }
  };

  const reactivate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const s = await subscriptionApi.reactivate(establishment._id);
      setSub(s);
    } catch {
      setError("Não foi possível reativar.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-5 text-ink/50">
        Carregando assinatura...
      </div>
    );
  }

  const badge = STATUS_LABEL[sub?.status || "none"];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Minha assinatura
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              Plano da sua conta no sistema.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}
          >
            {badge.text}
          </span>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        {/* Assinatura ativa */}
        {entitled && sub && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-teal-500/5 p-4 text-sm text-ink/80">
              Plano <b>{plan?.name || sub.planId}</b> ({sub.billingCycle}) —{" "}
              {brl(sub.priceCents)}
              {sub.currentPeriodEnd && (
                <>
                  {" "}
                  · próxima cobrança em{" "}
                  {new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")}
                </>
              )}
              {sub.cardLast4 && (
                <span className="mt-1 block text-xs text-ink/50">
                  Cartão {sub.cardBrand} •••• {sub.cardLast4}
                </span>
              )}
            </div>

            {sub.cancelAtPeriodEnd ? (
              <div className="space-y-2 rounded-lg bg-amber-400/10 p-3">
                <p className="text-sm font-medium text-amber-800">
                  Assinatura cancelada. Você mantém o acesso até{" "}
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")
                    : "o fim do período"}{" "}
                  e não será cobrado novamente.
                </p>
                <button
                  type="button"
                  onClick={reactivate}
                  disabled={submitting}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
                >
                  {submitting ? "Reativando..." : "Reativar assinatura"}
                </button>
              </div>
            ) : confirmingCancel ? (
              <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-sm text-ink/70">
                  Cancelar a assinatura? Você continua com acesso até{" "}
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")
                    : "o fim do período"}{" "}
                  e não será mais cobrado.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={submitting}
                    className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {submitting ? "Cancelando..." : "Confirmar cancelamento"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-sand"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10"
              >
                Cancelar assinatura
              </button>
            )}
          </div>
        )}

        {/* Aguardando pagamento */}
        {!entitled && sub?.status === "past_due" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink/70">
              Assinatura criada — assim que o pagamento cair, libera
              automaticamente (estamos verificando).
            </p>
            {/* QR Code do PIX */}
            {pixImage && (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={pixImage}
                  alt="QR Code PIX"
                  className="h-56 w-56 rounded-lg border border-ink/10 bg-white p-2"
                />
                <p className="text-xs text-ink/50">
                  Escaneie o QR no app do seu banco
                </p>
              </div>
            )}
            {/* PIX copia e cola */}
            {pixCode && (
              <div className="space-y-2">
                <p className="break-all rounded-lg bg-sand/60 px-3 py-2 text-xs text-ink/70">
                  {pixCode}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(pixCode)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                      .catch(() => {});
                  }}
                  className="rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600"
                >
                  {copied ? "Código copiado!" : "Copiar código PIX"}
                </button>
              </div>
            )}
            {/* fallback: sem QR (ex.: boleto), abre a cobranca */}
            {!pixImage && !pixCode && checkoutUrl && (
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                Pagar agora
              </a>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={submitting}
              className="ml-2 rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-sand disabled:opacity-50"
            >
              {submitting ? "Verificando..." : "Já paguei — atualizar"}
            </button>
          </div>
        )}
      </div>

      {/* Assinar (sem assinatura ativa) — plano = área do estabelecimento */}
      {!entitled && (
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-display font-bold text-ink">
            {sub?.status === "past_due" ? "Trocar cobrança" : "Assinar"}
          </h3>

          {plan ? (
            <div className="mt-3 rounded-xl bg-sand/50 p-4">
              <p className="font-semibold text-ink">{plan.name}</p>
              {plan.description && (
                <p className="mt-0.5 text-xs text-ink/60">{plan.description}</p>
              )}
              {cycle === "anual" ? (
                <>
                  {/* anual: preco cheio riscado + economia em destaque */}
                  <p className="mt-2 text-sm text-ink/40 line-through">
                    {brl(annualSavings(plan).fullYear)}/ano
                  </p>
                  <p className="text-lg font-bold text-teal-600">
                    {brl(annualSavings(plan).annual)}
                    <span className="text-xs font-normal text-ink/50">/ano</span>
                  </p>
                  <p className="text-xs text-ink/60">
                    Equivale a{" "}
                    <b className="text-ink/80">
                      {brl(annualSavings(plan).perMonth)}/mês
                    </b>
                  </p>
                  <div className="mt-3 rounded-lg bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-700">
                    🎉 Você economiza {brl(annualSavings(plan).saved)} por ano (
                    {annualSavings(plan).percent}% de desconto)
                  </div>
                </>
              ) : (
                <p className="mt-2 text-lg font-bold text-teal-600">
                  {brl(priceForCycle(plan, cycle))}
                  <span className="text-xs font-normal text-ink/50">/mês</span>
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/50">
              Não foi possível identificar o plano da área.
            </p>
          )}

          {/* ciclo */}
          <div className="mt-4 inline-flex rounded-xl bg-sand/60 p-1 text-sm">
            {(["mensal", "anual"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={`rounded-lg px-4 py-1.5 font-medium transition ${
                  cycle === c ? "bg-white text-ink shadow-sm" : "text-ink/60"
                }`}
              >
                {c === "mensal" ? (
                  "Mensal"
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    Anual
                    {plan && (
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-ink">
                        -{annualSavings(plan).percent}%
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* incentivo ao anual */}
          {plan && cycle === "mensal" && (
            <button
              type="button"
              onClick={() => setCycle("anual")}
              className="mt-3 block w-full rounded-xl border border-dashed border-teal-500/40 bg-teal-500/5 px-4 py-3 text-left text-sm transition hover:bg-teal-500/10"
            >
              <span className="font-semibold text-teal-700">
                💡 Economize {brl(annualSavings(plan).saved)} por ano no plano anual
              </span>
              <span className="mt-0.5 block text-ink/60">
                Sai por {brl(annualSavings(plan).perMonth)}/mês em vez de{" "}
                {brl(plan.monthlyCents)}/mês — 2 meses grátis.{" "}
                <span className="font-semibold text-teal-600 underline">
                  Mudar para anual
                </span>
              </span>
            </button>
          )}

          {plan && cycle === "anual" && (
            <ul className="mt-3 space-y-1.5 text-sm text-ink/70">
              <li className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>
                  <b>2 meses grátis</b>: paga 10 e usa 12 meses
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>
                  <b>{annualSavings(plan).percent}% de desconto</b> em relação ao
                  mensal
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>Uma cobrança só por ano — sem se preocupar todo mês</span>
              </li>
            </ul>
          )}

          {/* metodo */}
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Forma de pagamento
            </label>
            <div className="flex gap-2">
              {(["pix", "cartao"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    method === m
                      ? "bg-teal-500 text-white"
                      : "border border-ink/15 text-ink/70 hover:bg-sand"
                  }`}
                >
                  {m === "pix" ? "PIX" : "Cartão de crédito"}
                </button>
              ))}
            </div>
          </div>

          {/* dados do cartao (só no cartão) */}
          {method === "cartao" && (
            <div className="mt-4 space-y-3 rounded-xl bg-sand/40 p-4">
              <p className="text-xs font-semibold text-ink/60">
                Dados do cartão
              </p>
              <input
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                placeholder="Nome impresso no cartão"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <input
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Número do cartão"
                inputMode="numeric"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="Validade MM/AA"
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <input
                  value={cardCcv}
                  onChange={(e) => setCardCcv(e.target.value)}
                  placeholder="CVV"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  placeholder="CEP do titular"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <input
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  placeholder="Nº do endereço"
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefone do titular"
                inputMode="numeric"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <p className="text-[11px] text-ink/45">
                CEP, número e telefone são exigidos pela operadora do cartão
                (antifraude). O cartão fica salvo para a cobrança mensal.
              </p>
            </div>
          )}

          {/* dados de cobranca */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                CPF ou CNPJ
              </label>
              <input
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="Somente números"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                E-mail para cobrança
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={subscribe}
            disabled={submitting || !plan}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {submitting ? "Processando..." : "Assinar"}
          </button>
        </div>
      )}
    </div>
  );
}
