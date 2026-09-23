import { useCallback, useEffect, useRef, useState } from "react";

// Rolagem infinita reutilizavel para as listas do sistema. A pagina eh buscada
// no servidor (15 por vez por padrao). Um "sentinel" no fim da lista dispara o
// carregamento do proximo lote automaticamente quando entra na tela.

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  nextOffset: number;
}

export interface InfiniteList<T> {
  items: T[];
  loading: boolean; // carregando (primeira pagina ou proxima)
  loadingMore: boolean; // carregando SÓ a proxima pagina
  hasMore: boolean;
  error: boolean;
  // coloque <div ref={sentinelRef} /> logo abaixo da lista
  sentinelRef: (node: HTMLElement | null) => void;
  reload: () => void; // recomeça do offset 0
  loadMore: () => void; // força carregar o proximo lote
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

// fetchPage(offset) deve buscar no servidor e devolver { items, hasMore, nextOffset }.
// `deps` reseta a lista quando muda (ex.: troca de filtro/estabelecimento).
export function useInfiniteList<T>(
  fetchPage: (offset: number) => Promise<Page<T>>,
  deps: unknown[] = []
): InfiniteList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async (reset: boolean) => {
    if (loadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;
    loadingRef.current = true;
    setError(false);
    if (reset) {
      offsetRef.current = 0;
      hasMoreRef.current = true;
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const page = await fetchRef.current(offsetRef.current);
      setItems((prev) =>
        reset || offsetRef.current === 0 ? page.items : [...prev, ...page.items]
      );
      offsetRef.current = page.nextOffset;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // reset quando as dependencias mudam (filtros, estabelecimento, etc.)
  useEffect(() => {
    setItems([]);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    load(false);
  }, [load]);

  const reload = useCallback(() => {
    setItems([]);
    load(true);
  }, [load]);

  // IntersectionObserver no sentinel -> carrega o proximo lote ao chegar no fim
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            hasMoreRef.current &&
            !loadingRef.current
          ) {
            load(false);
          }
        },
        { rootMargin: "240px" }
      );
      io.observe(node);
      observerRef.current = io;
    },
    [load]
  );

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    sentinelRef,
    reload,
    loadMore,
    setItems,
  };
}
