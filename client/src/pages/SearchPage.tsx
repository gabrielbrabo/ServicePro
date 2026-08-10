import { useEffect, useState, useCallback } from "react";
import { PageContainer } from "../components/NavBar";
import { catalogApi, Category } from "../api/catalog";
import {
  establishmentApi,
  Establishment,
  SearchFilters,
} from "../api/establishment";
import { EstablishmentCard } from "../components/EstablishmentCard";
import { useAuth } from "../context/AuthContext";

export function SearchPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);

  // filtros
  const [activeCat, setActiveCat] = useState("");
  const [name, setName] = useState(""); // nome do estabelecimento
  const [service, setService] = useState(""); // nome do serviço
  const [city, setCity] = useState(""); // localização

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
    }),
    [activeCat, name, service, city, user]
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
  };

  const hasAnyFilter = activeCat || name || service || city;

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
          placeholder="Serviço (ex: corte, escova)"
          className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Cidade / localização"
          className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

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
            Nenhum estabelecimento encontrado. Tente outros filtros.
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
    </PageContainer>
  );
}