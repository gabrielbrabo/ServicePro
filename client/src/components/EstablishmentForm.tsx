import { useEffect, useState, FormEvent } from "react";
import { catalogApi, Category } from "../api/catalog";
import { establishmentApi, Establishment } from "../api/establishment";
import { AddressAutocomplete, ResolvedAddress } from "./AddressAutocomplete";
import { SEGMENT_LIST, SegmentKey, categorySegment } from "../lib/segments";
import { subscriptionApi } from "../api/subscription";
import { useAuth } from "../context/AuthContext";

// Cadastro em 3 etapas:
// 1) Área  ->  2) Plano (ciclo + método + dados de cobrança)  ->  3) Dados do negócio
// Ao final: cria o estabelecimento e a assinatura, e abre a página de pagamento.
export function EstablishmentForm({
  onCreated,
  onCancel,
}: {
  onCreated: (e: Establishment) => void;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [form, setForm] = useState({
    name: "",
    segment: "beleza" as SegmentKey,
    billingCycle: "mensal" as "mensal" | "anual",
    category: "",
    description: "",
    phone: "",
    country: "Brasil",
    state: "",
    city: "",
    neighborhood: "",
    street: "",
    number: "",
  });

  // dados de cobrança (assinatura)
  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  // dados do cartão (só quando method === "cartao")
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [cep, setCep] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [cardPhone, setCardPhone] = useState(user?.phone || "");

  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // link/código de quem indicou (afiliado/representante). Pré-preenche a partir
  // do ?ref guardado no link do afiliado; o dono também pode colar manualmente.
  const [referredBy, setReferredBy] = useState("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sp_ref");
      if (saved) setReferredBy(saved);
    } catch {
      // ambiente sem localStorage: ignora
    }
  }, []);
  // negócio já criado (para retentar o pagamento sem duplicar o cadastro)
  const [createdEst, setCreatedEst] = useState<Establishment | null>(null);
  // PIX gerado após assinar (mostrado na hora, antes de entrar no painel)
  const [pixAfter, setPixAfter] = useState<{
    image: string | null;
    code: string | null;
    url: string | null;
  } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const inputClass =
    "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

  const catInArea = (c: Category, seg: string) => {
    const s = categorySegment(c);
    return !s || s === seg;
  };
  const pickCategory = (list: Category[], seg: string) => {
    const match = list.find((c) => catInArea(c, seg));
    return (match || list[0])?._id || "";
  };

  useEffect(() => {
    catalogApi.categories().then((c) => {
      setCategories(c);
      setForm((f) => ({ ...f, category: pickCategory(c, f.segment) }));
    });
  }, []);

  const visibleCategories = categories.filter((c) =>
    catInArea(c, form.segment)
  );

  const update =
    (field: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm({ ...form, [field]: e.target.value });
    };

  const applyResolved = (addr: ResolvedAddress) => {
    setForm((f) => ({
      ...f,
      country: addr.country || "Brasil",
      state: addr.state,
      city: addr.city,
      neighborhood: addr.neighborhood,
      street: addr.street,
      number: addr.number || f.number,
    }));
    setCoords({ lat: addr.lat, lon: addr.lon });
    setError("");
  };

  // preço conforme a área e o ciclo
  const planPrice =
    SEGMENT_LIST.find((s) => s.key === form.segment)?.priceMonthly ?? 0;
  const annualPrice = planPrice * 10;
  const annualMonthly = annualPrice / 12;
  const money = (n: number) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  // MM/AA -> { month, year(YYYY) } | null
  const parseExpiry = (s: string) => {
    const m = s.trim().match(/^(\d{2})\s*\/\s*(\d{2,4})$/);
    if (!m) return null;
    return { month: m[1], year: m[2].length === 2 ? "20" + m[2] : m[2] };
  };

  // avança da etapa 2 (valida dados de cobrança)
  const goStep3 = () => {
    setError("");
    if (!cpfCnpj.trim()) {
      setError("Informe o CPF ou CNPJ do responsável pela cobrança.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Informe um e-mail válido para a cobrança.");
      return;
    }
    if (method === "cartao") {
      if (
        !cardHolder.trim() ||
        cardNumber.replace(/\s/g, "").length < 12 ||
        !parseExpiry(cardExpiry) ||
        cardCcv.trim().length < 3
      ) {
        setError("Preencha os dados do cartão (validade no formato MM/AA).");
        return;
      }
      if (!cep.trim() || !addressNumber.trim() || !cardPhone.trim()) {
        setError("Preencha CEP, número do endereço e telefone do titular.");
        return;
      }
    }
    setStep(3);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.category) {
      setError("Informe o nome e a categoria do negócio");
      return;
    }
    if (
      !form.country ||
      !form.state ||
      !form.city ||
      !form.neighborhood ||
      !form.street ||
      !form.number
    ) {
      setError("Preencha o endereço completo (use a busca para facilitar)");
      return;
    }

    setSaving(true);
    setError("");
    try {
      // reaproveita o negócio já criado numa tentativa anterior (evita duplicar
      // o estabelecimento se o pagamento falhar e o usuário tentar de novo)
      let est = createdEst;
      if (!est) {
        est = await establishmentApi.create({
          name: form.name,
          segment: form.segment,
          billingCycle: form.billingCycle,
          category: form.category,
          description: form.description || undefined,
          phone: form.phone || undefined,
          address: {
            country: form.country,
            state: form.state,
            city: form.city,
            neighborhood: form.neighborhood,
            street: form.street,
            number: form.number,
          },
          location: coords
            ? { type: "Point", coordinates: [coords.lon, coords.lat] }
            : undefined,
          // indicação: link/código do afiliado/representante que indicou
          ref: referredBy.trim() || undefined,
        });
        setCreatedEst(est);
      }

      // cria a assinatura (o plano é a área). Se falhar, o erro APARECE.
      const exp = parseExpiry(cardExpiry);
      const res = await subscriptionApi.subscribe(est._id, {
        planId: form.segment,
        billingCycle: form.billingCycle,
        method,
        cpfCnpj: cpfCnpj.trim(),
        email: email.trim(),
        card:
          method === "cartao" && exp
            ? {
                holderName: cardHolder.trim(),
                number: cardNumber.replace(/\s/g, ""),
                expiryMonth: exp.month,
                expiryYear: exp.year,
                ccv: cardCcv.trim(),
              }
            : undefined,
        holderInfo:
          method === "cartao"
            ? {
                postalCode: cep.replace(/\D/g, ""),
                addressNumber: addressNumber.trim(),
                phone: cardPhone.replace(/\D/g, ""),
              }
            : undefined,
      });

      // PIX: mostra o QR/copia-e-cola AQUI mesmo, na hora. Cartão: já cobrado,
      // entra direto no painel.
      if (
        method === "pix" &&
        (res.pixQrImage || res.pixCopiaECola || res.checkoutUrl)
      ) {
        setPixAfter({
          image: res.pixQrImage || null,
          code: res.pixCopiaECola || null,
          url: res.checkoutUrl || null,
        });
        return;
      }
      onCreated(est);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(
        createdEst
          ? `Pagamento não concluído: ${msg || "tente novamente"}`
          : msg || "Não foi possível concluir o cadastro. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  };

  // PIX pendente: verifica sozinho e entra no painel quando o pagamento cair
  // (sem depender do clique). Cartão nem chega aqui — já entra direto.
  useEffect(() => {
    if (!pixAfter || !createdEst) return;
    let n = 0;
    const id = setInterval(async () => {
      n += 1;
      try {
        const s = await subscriptionApi.refresh(createdEst._id);
        if (s.status === "active" || s.status === "trialing") {
          clearInterval(id);
          onCreated(createdEst);
        }
      } catch {
        /* ignora e tenta de novo */
      }
      if (n >= 75) clearInterval(id); // para depois de ~5min
    }, 4000);
    return () => clearInterval(id);
  }, [pixAfter, createdEst, onCreated]);

  // indicador de etapas
  const StepDots = () => (
    <div className="mb-5 flex items-center gap-2 text-xs font-medium">
      {[
        [1, "Área"],
        [2, "Plano"],
        [3, "Dados"],
      ].map(([n, label]) => (
        <div key={n as number} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              step >= (n as number)
                ? "bg-teal-500 text-white"
                : "bg-ink/10 text-ink/50"
            }`}
          >
            {n}
          </span>
          <span className={step === (n as number) ? "text-ink" : "text-ink/40"}>
            {label}
          </span>
          {(n as number) < 3 && <span className="text-ink/20">›</span>}
        </div>
      ))}
    </div>
  );

  // Tela do PIX após assinar: mostra o QR e o copia-e-cola na hora.
  if (pixAfter) {
    return (
      <div className="space-y-4 text-center">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">
            Pague a assinatura com PIX
          </h3>
          <p className="mt-1 text-sm text-ink/60">
            Assim que o pagamento cair, sua assinatura é liberada
            automaticamente.
          </p>
        </div>

        {pixAfter.image && (
          <img
            src={pixAfter.image}
            alt="QR Code PIX"
            className="mx-auto h-60 w-60 rounded-lg border border-ink/10 bg-white p-2"
          />
        )}

        {pixAfter.code && (
          <div className="space-y-2">
            <p className="break-all rounded-lg bg-sand/60 px-3 py-2 text-left text-xs text-ink/70">
              {pixAfter.code}
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(pixAfter.code as string)
                  .then(() => {
                    setCopiedPix(true);
                    setTimeout(() => setCopiedPix(false), 2000);
                  })
                  .catch(() => {});
              }}
              className="w-full rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600"
            >
              {copiedPix ? "Código copiado!" : "Copiar código PIX"}
            </button>
          </div>
        )}

        {!pixAfter.image && !pixAfter.code && pixAfter.url && (
          <a
            href={pixAfter.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            Abrir a cobrança
          </a>
        )}

        <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          Aguardando a confirmação do pagamento…
        </div>

        <button
          type="button"
          onClick={() => createdEst && onCreated(createdEst)}
          className="w-full rounded-lg border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
        >
          Ir para o painel
        </button>
        <p className="text-xs text-ink/40">
          Assim que o pagamento cair, entra no painel automaticamente.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <StepDots />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ETAPA 1 — ÁREA */}
      {step === 1 && (
        <>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Área do negócio
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              {SEGMENT_LIST.map((s) => {
                const active = form.segment === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        segment: s.key,
                        category: pickCategory(categories, s.key),
                      }))
                    }
                    className={`rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-teal-500 ring-2 ring-teal-500/20"
                        : "border-ink/15 hover:border-teal-500"
                    }`}
                  >
                    <p className="font-semibold text-ink">{s.label}</p>
                    <p className="mt-0.5 text-xs text-ink/50">{s.description}</p>
                    <p className="mt-2 text-sm font-semibold text-teal-600">
                      R$ {s.priceMonthly}/mês
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
            >
              Continuar
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand"
              >
                Cancelar
              </button>
            )}
          </div>
        </>
      )}

      {/* ETAPA 2 — PLANO + MÉTODO + DADOS DE COBRANÇA */}
      {step === 2 && (
        <>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Plano ({SEGMENT_LIST.find((s) => s.key === form.segment)?.label})
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, billingCycle: "mensal" }))
                }
                className={`rounded-xl border p-4 text-left transition ${
                  form.billingCycle === "mensal"
                    ? "border-teal-500 ring-2 ring-teal-500/20"
                    : "border-ink/15 hover:border-teal-500"
                }`}
              >
                <p className="font-semibold text-ink">Mensal</p>
                <p className="mt-2 text-sm font-semibold text-teal-600">
                  R$ {money(planPrice)}/mês
                </p>
                <p className="mt-0.5 text-xs text-ink/50">Cobrança todo mês</p>
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, billingCycle: "anual" }))}
                className={`relative rounded-xl border p-4 text-left transition ${
                  form.billingCycle === "anual"
                    ? "border-teal-500 ring-2 ring-teal-500/20"
                    : "border-ink/15 hover:border-teal-500"
                }`}
              >
                <span className="absolute right-2 top-2 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-600">
                  2 MESES GRÁTIS
                </span>
                <p className="font-semibold text-ink">Anual</p>
                <p className="mt-2 text-sm font-semibold text-teal-600">
                  R$ {money(annualPrice)}/ano
                </p>
                <p className="mt-0.5 text-xs text-ink/50">
                  equivale a R$ {money(annualMonthly)}/mês
                </p>
              </button>
            </div>
          </div>

          {/* método */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Forma de pagamento
            </span>
            <div className="flex gap-2">
              {(["pix", "cartao"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition ${
                    method === m
                      ? "border-teal-500 bg-teal-500 text-white"
                      : "border-ink/15 text-ink/70 hover:bg-sand"
                  }`}
                >
                  {m === "pix" ? "PIX" : "Cartão de crédito"}
                </button>
              ))}
            </div>
          </div>

          {/* dados do cartão (só no cartão) */}
          {method === "cartao" && (
            <div className="space-y-3 rounded-xl border border-ink/10 bg-sand/40 p-4">
              <p className="text-sm font-semibold text-ink/70">
                Dados do cartão
              </p>
              <input
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                placeholder="Nome impresso no cartão"
                className={inputClass}
              />
              <input
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Número do cartão"
                inputMode="numeric"
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="Validade MM/AA"
                  className={inputClass}
                />
                <input
                  value={cardCcv}
                  onChange={(e) => setCardCcv(e.target.value)}
                  placeholder="CVV"
                  inputMode="numeric"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  placeholder="CEP do titular"
                  inputMode="numeric"
                  className={inputClass}
                />
                <input
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  placeholder="Nº do endereço"
                  className={inputClass}
                />
              </div>
              <input
                value={cardPhone}
                onChange={(e) => setCardPhone(e.target.value)}
                placeholder="Telefone do titular"
                inputMode="numeric"
                className={inputClass}
              />
              <p className="text-[11px] text-ink/45">
                CEP, número e telefone são exigidos pela operadora do cartão
                (antifraude). O cartão fica salvo para a cobrança mensal.
              </p>
            </div>
          )}

          {/* dados de cobrança */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                CPF ou CNPJ
              </span>
              <input
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="Somente números"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                E-mail para cobrança
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className={inputClass}
              />
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={goStep3}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
            >
              Continuar
            </button>
          </div>
        </>
      )}

      {/* ETAPA 3 — DADOS DO NEGÓCIO */}
      {step === 3 && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Nome do negócio
            </span>
            <input
              value={form.name}
              onChange={update("name")}
              placeholder="Ex: Barbearia do João - Centro"
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Categoria
              </span>
              <select
                value={form.category}
                onChange={update("category")}
                className={inputClass}
              >
                {visibleCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Telefone
              </span>
              <input
                value={form.phone}
                onChange={update("phone")}
                placeholder="(38) 99999-0000"
                className={inputClass}
              />
            </label>
          </div>

          <div className="rounded-xl border border-ink/10 bg-sand/50 p-4">
            <p className="mb-3 text-sm font-semibold text-ink/70">Endereço</p>
            <AddressAutocomplete onResolved={applyResolved} />
            {coords && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-600">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Localização confirmada no mapa
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Rua
                </span>
                <input
                  value={form.street}
                  onChange={update("street")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Número
                </span>
                <input
                  value={form.number}
                  onChange={update("number")}
                  placeholder="Ex: 1373"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Bairro
                </span>
                <input
                  value={form.neighborhood}
                  onChange={update("neighborhood")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Cidade
                </span>
                <input
                  value={form.city}
                  onChange={update("city")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Estado (UF)
                </span>
                <input
                  value={form.state}
                  onChange={update("state")}
                  placeholder="Ex: MG"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  País
                </span>
                <input
                  value={form.country}
                  onChange={update("country")}
                  className={inputClass}
                  disabled
                />
              </label>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Descrição
            </span>
            <textarea
              value={form.description}
              onChange={update("description")}
              rows={2}
              className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal-500"
            />
          </label>

          {/* indicação: link/código de quem indicou (afiliado/representante) */}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Link de quem indicou{" "}
              <span className="font-normal text-ink/40">(opcional)</span>
            </span>
            <input
              value={referredBy}
              onChange={(e) => setReferredBy(e.target.value)}
              placeholder="Cole aqui o link do afiliado/representante que indicou você"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink/40">
              Se você chegou pelo link de um afiliado/representante, ele já vem
              preenchido. Assim ele recebe a comissão da sua indicação.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving
                ? "Processando..."
                : createdEst
                ? "Tentar pagamento novamente"
                : "Criar e ir para o pagamento"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
