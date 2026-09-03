import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "../components/NavBar";
import { establishmentApi, Establishment } from "../api/establishment";
import { catalogApi, Category } from "../api/catalog";
import {
  AddressAutocomplete,
  ResolvedAddress,
} from "../components/AddressAutocomplete";
import { useEstablishments } from "../context/EstablishmentContext";
import {
  SEGMENTS,
  SegmentKey,
  DEFAULT_SEGMENT,
  categorySegment,
  isSegment,
} from "../lib/segments";

export function EstablishmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refresh } = useEstablishments();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    country: "Brasil",
    state: "",
    city: "",
    neighborhood: "",
    street: "",
    number: "",
  });
  // coordenadas: null = nao mexeu; preenchido = novo endereco escolhido
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );
  // atendimento a domicilio (padrao do estabelecimento)
  const [home, setHome] = useState({
    enabled: false,
    avgSpeedKmh: "25",
    baseFee: "0",
    feePerKm: "0",
    maxRadiusKm: "0",
  });

  // categoria + area do estabelecimento. A AREA (segment) nao muda na edicao;
  // so e possivel trocar a categoria por outra da mesma area.
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [segment, setSegment] = useState<SegmentKey>(DEFAULT_SEGMENT);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const inputClass =
    "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

  // categoria pertence a area? (categoria sem area definida serve a qualquer uma)
  const catInArea = (c: Category, seg: string) => {
    const s = categorySegment(c);
    return !s || s === seg;
  };

  // carrega a lista de categorias (para o seletor)
  useEffect(() => {
    catalogApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // carrega o estabelecimento
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    establishmentApi
      .getById(id)
      .then((est: Establishment) => {
        setForm({
          name: est.name || "",
          description: est.description || "",
          phone: est.phone || "",
          country: est.address?.country || "Brasil",
          state: est.address?.state || "",
          city: est.address?.city || "",
          neighborhood: est.address?.neighborhood || "",
          street: est.address?.street || "",
          number: est.address?.number || "",
        });
        const h = est.homeService;
        setHome({
          enabled: !!h?.enabled,
          avgSpeedKmh: String(h?.avgSpeedKmh ?? 25),
          baseFee: String(h?.baseFee ?? 0),
          feePerKm: String(h?.feePerKm ?? 0),
          maxRadiusKm: String(h?.maxRadiusKm ?? 0),
        });
        setCategoryId(est.category?._id || "");
        // area: usa a gravada no estabelecimento; senao infere pela categoria
        const seg = isSegment(est.segment)
          ? est.segment
          : categorySegment(est.category) || DEFAULT_SEGMENT;
        setSegment(seg);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const update =
    (field: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm({ ...form, [field]: e.target.value });
    };

  // ao escolher um endereco no autocomplete, preenche os campos + coordenadas
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

  // categorias visiveis: mesma area do estabelecimento (mais a atual, sempre)
  const visibleCategories = useMemo(() => {
    const list = categories.filter(
      (c) => catInArea(c, segment) || c._id === categoryId
    );
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, segment, categoryId]);

  const save = async () => {
    if (!id) return;
    setError("");
    setSavedMsg("");

    if (!form.name.trim()) {
      setError("O nome não pode ficar vazio.");
      return;
    }
    if (!categoryId) {
      setError("Selecione uma categoria.");
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
      setError("Preencha o endereço completo (use a busca para facilitar).");
      return;
    }

    setSaving(true);
    try {
      await establishmentApi.update(id, {
        name: form.name.trim(),
        description: form.description.trim(),
        phone: form.phone.trim(),
        category: categoryId,
        address: {
          country: form.country,
          state: form.state,
          city: form.city,
          neighborhood: form.neighborhood,
          street: form.street,
          number: form.number,
        },
        // so envia coordenadas se o usuario escolheu um novo endereco
        ...(coords
          ? {
              location: {
                type: "Point",
                coordinates: [coords.lon, coords.lat] as [number, number],
              },
            }
          : {}),
        homeService: {
          enabled: home.enabled,
          avgSpeedKmh: Math.max(1, Number(home.avgSpeedKmh) || 25),
          baseFee: Math.max(0, Number(home.baseFee) || 0),
          feePerKm: Math.max(0, Number(home.feePerKm) || 0),
          maxRadiusKm: Math.max(0, Number(home.maxRadiusKm) || 0),
        },
      });
      // atualiza a lista/estado do painel
      refresh();
      setSavedMsg("Alterações salvas.");
      // volta ao painel apos um instante
      setTimeout(() => navigate("/painel"), 700);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Não foi possível salvar. Tente novamente.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <p className="text-ink/50">Carregando...</p>
      </PageContainer>
    );
  }

  if (notFound) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-lg rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <p className="text-ink/60">Estabelecimento não encontrado.</p>
          <button
            onClick={() => navigate("/painel")}
            className="mt-4 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Voltar ao painel
          </button>
        </div>
      </PageContainer>
    );
  }

  const sectionTitle = "font-display text-lg font-bold text-ink";
  const fieldLabel = "mb-1.5 block text-sm font-medium text-ink/70";
  const areaLabel = SEGMENTS[segment]?.label || "—";

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate("/painel")}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
          >
            ← Voltar
          </button>
          <h1 className="font-display text-2xl font-bold text-ink">
            Editar estabelecimento
          </h1>
        </div>

        {savedMsg && (
          <div className="mb-4 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
            {savedMsg}
          </div>
        )}

        <div className="space-y-5">
          {/* ---- Informações do negócio ---- */}
          <section className="rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className={sectionTitle}>Informações do negócio</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className={fieldLabel}>Nome do negócio</span>
                <input
                  value={form.name}
                  onChange={update("name")}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={fieldLabel}>Telefone</span>
                <input
                  value={form.phone}
                  onChange={update("phone")}
                  placeholder="(38) 99999-0000"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={fieldLabel}>Descrição</span>
                <textarea
                  value={form.description}
                  onChange={update("description")}
                  rows={3}
                  className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal-500"
                />
              </label>
            </div>
          </section>

          {/* ---- Categoria e área ---- */}
          <section className="rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className={sectionTitle}>Categoria e área</h2>

            {/* área — somente leitura (define ferramentas e cobrança) */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-sand/50 px-4 py-3">
              <div>
                <span className="block text-sm font-medium text-ink/70">
                  Área do negócio
                </span>
                <span className="text-xs text-ink/50">
                  A área define as ferramentas do painel e não pode ser
                  alterada aqui.
                </span>
              </div>
              <span className="rounded-full bg-teal-500/10 px-3 py-1 text-sm font-semibold text-teal-600">
                {areaLabel}
              </span>
            </div>

            <label className="mt-4 block">
              <span className={fieldLabel}>Categoria</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputClass}
              >
                {visibleCategories.length === 0 && (
                  <option value="">Nenhuma categoria disponível</option>
                )}
                {visibleCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-xs text-ink/50">
                Só aparecem categorias da área{" "}
                <span className="font-medium text-ink/70">{areaLabel}</span>.
                Trocar a categoria pode ajustar recursos específicos (ex.:
                odontograma, ficha do aluno) dentro da mesma área.
              </span>
            </label>
          </section>

          {/* ---- Endereço ---- */}
          <section className="rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className={sectionTitle}>Endereço</h2>
            <p className="mt-3 text-xs text-ink/50">
              Endereço atual:{" "}
              {[
                form.street,
                form.number,
                form.neighborhood,
                form.city,
                form.state,
              ]
                .filter(Boolean)
                .join(", ") || "não informado"}
            </p>

            <div className="mt-3">
              <AddressAutocomplete
                onResolved={applyResolved}
                label="Buscar novo endereço"
                hint="Digite e escolha na lista para atualizar o endereço e a localização no mapa."
              />
            </div>

            {coords && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-600">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Nova localização confirmada no mapa
              </p>
            )}

            {/* campos editaveis para ajuste fino */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>Rua</span>
                <input
                  value={form.street}
                  onChange={update("street")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Número</span>
                <input
                  value={form.number}
                  onChange={update("number")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Bairro</span>
                <input
                  value={form.neighborhood}
                  onChange={update("neighborhood")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Cidade</span>
                <input
                  value={form.city}
                  onChange={update("city")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Estado (UF)</span>
                <input
                  value={form.state}
                  onChange={update("state")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>País</span>
                <input
                  value={form.country}
                  onChange={update("country")}
                  className={inputClass}
                  disabled
                />
              </label>
            </div>
          </section>

          {/* ---- Atendimento a domicílio ---- */}
          <section className="rounded-2xl border border-ink/10 bg-white p-6">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-ink/70">
                  Atendimento a domicílio
                </span>
                <span className="block text-xs text-ink/50">
                  Permite marcar serviços na casa do cliente. O deslocamento
                  (ida e volta) é reservado na agenda automaticamente.
                </span>
              </span>
              <input
                type="checkbox"
                checked={home.enabled}
                onChange={(e) =>
                  setHome({ ...home, enabled: e.target.checked })
                }
                className="h-5 w-5 shrink-0 accent-teal-500"
              />
            </label>

            {home.enabled && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Velocidade média (km/h)
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={home.avgSpeedKmh}
                    onChange={(e) =>
                      setHome({ ...home, avgSpeedKmh: e.target.value })
                    }
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-ink/40">
                    Usada para estimar o tempo de deslocamento.
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Raio máximo (km)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={home.maxRadiusKm}
                    onChange={(e) =>
                      setHome({ ...home, maxRadiusKm: e.target.value })
                    }
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-ink/40">
                    0 = sem limite de distância.
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Taxa fixa de deslocamento (R$)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={home.baseFee}
                    onChange={(e) =>
                      setHome({ ...home, baseFee: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Taxa por km rodado (R$)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={home.feePerKm}
                    onChange={(e) =>
                      setHome({ ...home, feePerKm: e.target.value })
                    }
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-ink/40">
                    Cobrada sobre a distância de ida e volta.
                  </span>
                </label>
              </div>
            )}
          </section>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              onClick={() => navigate("/painel")}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
