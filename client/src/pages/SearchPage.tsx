import { useEffect, useState, useCallback } from "react";
import { PageContainer } from "../components/NavBar";
import { catalogApi, Category } from "../api/catalog";
import {
  establishmentApi,
  Establishment,
  SearchFilters,
} from "../api/establishment";
import { EstablishmentCard } from "../components/EstablishmentCard";
import {
  LocationRadiusModal,
  GeoCoords,
} from "../components/LocationRadiusModal";
import { useAuth } from "../context/AuthContext";

// Categorias em destaque (recolhido). FIXAS: 2 beleza + 4 saude + 2 gerais.
// (Antes havia rodizio trimestral; agora ficam FIXAS nas atuais. Para trocar
// no futuro, edite ORIGINAL_SLUGS abaixo.) As demais ficam no "Ver mais
// categorias".
const FEATURED_MIX: { seg: "beleza" | "saude" | "geral"; count: number }[] = [
  { seg: "beleza", count: 2 },
  { seg: "saude", count: 4 },
  { seg: "geral", count: 2 },
];
// Categorias fixas atuais (ordem em que aparecem).
const ORIGINAL_SLUGS = [
  "barbearia",
  "salao-de-beleza",
  "fisioterapia",
  "enfermagem",
  "odontologia",
  "psicologia",
  "refrigeracao",
  "estetica-automotiva",
];
function featuredCategories(cats: Category[]): Category[] {
  // FIXO: sempre as categorias atuais (originais), sem rodizio por data.
  const out: Category[] = [];
  for (const { seg, count } of FEATURED_MIX) {
    const all = cats.filter((c) => c.segment === seg);
    // as originais primeiro (na ordem definida), depois o resto por _id
    const originals = ORIGINAL_SLUGS.map((sl) =>
      all.find((c) => c.slug === sl)
    ).filter((c): c is Category => Boolean(c));
    const rest = all
      .filter((c) => !ORIGINAL_SLUGS.includes(c.slug))
      .sort((a, b) => a._id.localeCompare(b._id));
    const group = [...originals, ...rest];
    if (group.length === 0) continue;
    // pega as primeiras `count` (originais primeiro) — sempre as mesmas
    for (let i = 0; i < count && i < group.length; i++) {
      out.push(group[i]);
    }
  }
  return out;
}

export function SearchPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAllCats, setShowAllCats] = useState(false);

  // filtros
  const [activeCat, setActiveCat] = useState("");
  const [name, setName] = useState(""); // nome do estabelecimento
  const [service, setService] = useState(""); // nome do serviço
  const [city, setCity] = useState(""); // localização

  // busca por raio (geolocalizacao)
  const [geoCoords, setGeoCoords] = useState<GeoCoords | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  // resultados + paginação
  const [items, setItems] = useState<Establishment[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    catalogApi.categories().then(setCategories);
  }, []);

  // monta os filtros atuais (inclui cidade/estado do usuário para priorizar)
  const buildFilters = useCallback(
    (pageNum: number): SearchFilters => ({
      category: activeCat || undefined,
      q: name || undefined,
      service: service || undefined,
      city: city || undefined,
      page: pageNum,
      userCity: user?.city || undefined,
      userState: user?.state || undefined,
      // so envia geo quando ha coordenadas E raio definidos
      lat: geoCoords?.lat,
      lng: geoCoords?.lng,
      radiusKm: geoCoords && radiusKm ? radiusKm : undefined,
    }),
    [activeCat, name, service, city, user, geoCoords, radiusKm]
  );

  // busca a primeira página sempre que um filtro muda (com debounce nos textos)
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setPage(1);
      establishmentApi
        .search(buildFilters(1))
        .then((res) => {
          setItems(res.items);
          setHasMore(res.hasMore);
          setTotal(res.total);
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [buildFilters]);

  // carregar mais (próxima página, acumula)
  const loadMore = () => {
    const next = page + 1;
    setLoadingMore(true);
    establishmentApi
      .search(buildFilters(next))
      .then((res) => {
        setItems((prev) => [...prev, ...res.items]);
        setPage(next);
        setHasMore(res.hasMore);
      })
      .finally(() => setLoadingMore(false));
  };

  const clearFilters = () => {
    setActiveCat("");
    setName("");
    setService("");
    setCity("");
    setGeoCoords(null);
    setRadiusKm(null);
  };

  // aplica a busca por raio vinda do modal
  const applyRadius = (coords: GeoCoords, km: number) => {
    setGeoCoords(coords);
    setRadiusKm(km);
    setLocationModalOpen(false);
  };

  const clearRadius = () => {
    setGeoCoords(null);
    setRadiusKm(null);
  };

  const geoActive = Boolean(geoCoords && radiusKm);
  const hasAnyFilter = activeCat || name || service || city || geoActive;

  // categorias principais (as do MAIN_SLUGS que existem); se nenhuma casar,
  // cai nas 8 primeiras. Recolhido mostra so essas; "Ver mais" mostra todas.
  const mainCategories = featuredCategories(categories);
  const collapsedCategories =
    mainCategories.length > 0 ? mainCategories : categories.slice(0, 8);
  const visibleCategories = showAllCats ? categories : collapsedCategories;
  // se a categoria selecionada nao esta entre as visiveis, mostra-a tambem
  const activeHidden =
    !showAllCats &&
    activeCat &&
    !visibleCategories.some((c) => c._id === activeCat);
  const activeCategory = activeHidden
    ? categories.find((c) => c._id === activeCat)
    : undefined;
  const canToggleCats = categories.length > collapsedCategories.length;

  return (
    <PageContainer>
      <h1 className="font-display text-3xl font-bold text-ink">
        Explore e agende
      </h1>
      <p className="mt-1 text-ink/60">
        Encontre o serviço que você precisa e agende com os melhores
        estabelecimentos perto de você.
      </p>

      {/* Campos de busca */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do estabelecimento"
          className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <input
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="Serviço"
          className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />

        {/* Cidade + botao de localizacao (busca por raio) */}
        <div className="relative">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Cidade / localização"
            className="h-12 w-full rounded-xl border border-ink/15 bg-white pl-4 pr-12 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          {/* pulso atras do pino: chama atencao enquanto o usuario nao usou */}
          {!geoActive && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-xl bg-teal-500/40 animate-ping"
            />
          )}
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            aria-label="Buscar por perto usando minha localização"
            title="Buscar estabelecimentos perto de você"
            className={`absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-white shadow-md ring-2 transition ${
              geoActive
                ? "bg-teal-600 ring-teal-500/40"
                : "bg-teal-500 ring-teal-400/50 hover:bg-teal-600"
            }`}
          >
            {/* icone de pin de localizacao */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* dica: deixa claro que dá para buscar por perto (some quando ativo) */}
      {!geoActive && (
        <button
          type="button"
          onClick={() => setLocationModalOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-500/20 dark:text-teal-300"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Toque no pino para buscar perto de você
        </button>
      )}

      {/* Chip do raio ativo */}
      {geoActive && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 py-1.5 pl-3 pr-1.5 text-sm font-medium text-teal-700">
            📍 A até {radiusKm} km de você
            <button
              type="button"
              onClick={clearRadius}
              aria-label="Remover busca por raio"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/20 text-teal-700 transition hover:bg-teal-500 hover:text-white"
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {/* Filtro por categoria */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCat("")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !activeCat
              ? "bg-teal-500 text-white"
              : "bg-white text-ink/70 ring-1 ring-ink/10 hover:bg-sand"
          }`}
        >
          Todas
        </button>
        {/* categoria selecionada que esta escondida no recolhido: mostra o chip */}
        {activeCategory && (
          <button
            key={activeCategory._id}
            onClick={() => setActiveCat(activeCategory._id)}
            className="rounded-full bg-teal-500 px-4 py-2 text-sm font-medium text-white transition"
          >
            {activeCategory.icon} {activeCategory.name}
          </button>
        )}
        {visibleCategories.map((c) => (
          <button
            key={c._id}
            onClick={() => setActiveCat(c._id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeCat === c._id
                ? "bg-teal-500 text-white"
                : "bg-white text-ink/70 ring-1 ring-ink/10 hover:bg-sand"
            }`}
          >
            {c.icon} {c.name}
          </button>
        ))}
        {canToggleCats && (
          <button
            onClick={() => setShowAllCats((v) => !v)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-teal-600 ring-1 ring-teal-300 transition hover:bg-teal-50"
          >
            {showAllCats ? "Ver menos" : "Ver mais categorias"}
          </button>
        )}
      </div>

      {/* Cabeçalho dos resultados */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          {loading
            ? "Buscando..."
            : `${total} estabelecimento${total !== 1 ? "s" : ""} encontrado${
                total !== 1 ? "s" : ""
              }`}
        </p>
        {hasAnyFilter && (
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-teal-600 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Resultados */}
      <div className="mt-3">
        {loading ? (
          <p className="text-ink/50">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-12 text-center text-ink/50">
            {geoActive
              ? "Nenhum estabelecimento neste raio. Aumente a distância ou remova o filtro de localização."
              : "Nenhum estabelecimento encontrado. Tente outros filtros."}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {items.map((e) => (
                <EstablishmentCard key={e._id} establishment={e} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-xl border border-ink/15 bg-white px-6 py-3 font-semibold text-ink/80 transition hover:bg-sand disabled:opacity-60"
                >
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {locationModalOpen && (
        <LocationRadiusModal
          initialRadiusKm={radiusKm}
          initialCoords={geoCoords}
          onClose={() => setLocationModalOpen(false)}
          onApply={applyRadius}
        />
      )}
    </PageContainer>
  );
}