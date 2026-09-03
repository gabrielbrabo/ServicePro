import { useEffect, useState, FormEvent } from "react";
import { catalogApi, Category } from "../api/catalog";
import { establishmentApi, Establishment } from "../api/establishment";
import { AddressAutocomplete, ResolvedAddress } from "./AddressAutocomplete";
import { SEGMENT_LIST, SegmentKey, categorySegment } from "../lib/segments";

export function EstablishmentForm({
  onCreated,
  onCancel,
}: {
  onCreated: (e: Establishment) => void;
  onCancel?: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);

  const [form, setForm] = useState({
    name: "",
    // area do negocio: define as ferramentas e o preco
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

  // coordenadas obtidas pelo autocomplete (para o mapa e a busca)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputClass =
    "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

  // categoria pertence a area? (categoria sem area definida serve a qualquer uma)
  const catInArea = (c: Category, seg: string) => {
    const s = categorySegment(c);
    return !s || s === seg;
  };

  // 1a categoria valida para uma area
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

  // categorias visiveis para a area escolhida
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

  // quando o usuario escolhe um endereco no autocomplete, preenche tudo
  const applyResolved = (addr: ResolvedAddress) => {
    setForm((f) => ({
      ...f,
      country: addr.country || "Brasil",
      state: addr.state,
      city: addr.city,
      neighborhood: addr.neighborhood,
      street: addr.street,
      number: addr.number || f.number, // mantem se o Google nao trouxe numero
    }));
    setCoords({ lat: addr.lat, lon: addr.lon });
    setError("");
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

    try {
      const created = await establishmentApi.create({
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
        // coordenadas do autocomplete; backend usa como fonte e evita geocode
        location: coords
          ? { type: "Point", coordinates: [coords.lon, coords.lat] }
          : undefined,
      });

      onCreated(created);
    } catch {
      setError("Não foi possível criar o negócio");
    } finally {
      setSaving(false);
    }
  };

  // preço do plano conforme a área escolhida (anual = 2 meses grátis)
  const planPrice =
    SEGMENT_LIST.find((s) => s.key === form.segment)?.priceMonthly ?? 0;
  const annualPrice = planPrice * 10;
  const annualMonthly = annualPrice / 12;
  const money = (n: number) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Área do negócio — define as ferramentas disponíveis e o preço */}
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
                    // reseta a categoria para uma valida da nova area
                    category: pickCategory(categories, s.key),
                  }))
                }
                className={`rounded-xl border p-4 text-left transition ${active
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

      {/* Plano de pagamento */}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink/70">
          Plano
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, billingCycle: "mensal" }))}
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
              equivale a R$ {money(annualMonthly)}/mês · economize R$ {money(planPrice * 2)}
            </p>
          </button>
        </div>
      </div>

      {/* Nome */}
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

      {/* Categoria + Telefone */}
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

      {/* Endereço */}
      <div className="rounded-xl border border-ink/10 bg-sand/50 p-4">
        <p className="mb-3 text-sm font-semibold text-ink/70">Endereço</p>

        {/* busca inteligente: preenche os campos abaixo + coordenadas */}
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

        {/* campos preenchidos automaticamente; editaveis para ajuste fino */}
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

      {/* Descrição */}
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

      {/* Erro */}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Botões */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {saving ? "Criando..." : "Criar negócio"}
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
    </form>
  );
}