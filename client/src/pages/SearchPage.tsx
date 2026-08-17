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

export function SearchPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);

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

  return (
    <PageContainer>
      <h1 className="font-display text-3xl font-bold text-ink">
        Encontre e agende
      </h1>
      <p className="mt-1 text-ink/60">
        Busque por estabelecimento, serviço ou localização.
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
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            aria-label="Buscar por perto usando minha localização"
            title="Buscar por perto"
            className={`absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition ${
              geoActive
                ? "bg-teal-500 text-white"
                : "text-ink/45 hover:bg-sand hover:text-teal-600"
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
        {categories.map((c) => (
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