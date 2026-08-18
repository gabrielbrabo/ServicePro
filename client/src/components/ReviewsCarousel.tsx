import { useEffect, useRef, useState } from "react";
import { reviewApi, EstablishmentReview } from "../api/review";
import { Stars } from "./Stars";

// Carrossel de avaliacoes (2 linhas) para a pagina publica do estabelecimento.
// Busca sozinho e se esconde quando nao ha avaliacoes.
export function ReviewsCarousel({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [reviews, setReviews] = useState<EstablishmentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reviewApi
      .listPublic(establishmentId)
      .then((list) => {
        if (alive) setReviews(list);
      })
      .catch(() => {
        if (alive) setReviews([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [establishmentId]);

  // some enquanto carrega ou quando nao ha avaliacoes
  if (loading || reviews.length === 0) return null;

  const showArrows = reviews.length > 2;

  // agrupa em colunas de 2 => 2 linhas no carrossel
  const columns: EstablishmentReview[][] = [];
  for (let i = 0; i < reviews.length; i += 2) {
    columns.push(reviews.slice(i, i + 2));
  }

  const scroll = (dir: -1 | 1) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.max(el.clientWidth * 0.8, 260),
      behavior: "smooth",
    });
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-ink">Avaliações</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink/40">
            {reviews.length} avalia{reviews.length !== 1 ? "ções" : "ção"}
          </span>
          {showArrows && (
            <div className="hidden gap-1 sm:flex">
              <button
                type="button"
                onClick={() => scroll(-1)}
                aria-label="Avaliações anteriores"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scroll(1)}
                aria-label="Próximas avaliações"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={carouselRef}
        className="mt-4 flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin] snap-x snap-mandatory"
      >
        {columns.map((col, ci) => (
          <div
            key={ci}
            className="flex w-[85%] shrink-0 snap-start flex-col gap-3 sm:w-96"
          >
            {col.map((r) => (
              <div
                key={r._id}
                className="flex flex-1 flex-col rounded-2xl border border-ink/10 bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  {r.client?.avatar ? (
                    <img
                      src={r.client.avatar}
                      alt={r.client.name}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-600">
                      {(r.client?.name || "C").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {r.client?.name || "Cliente"}
                    </p>
                    {r.service && (
                      <p className="truncate text-xs text-ink/50">
                        {r.service.title}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  <Stars value={r.rating} showValue={false} />
                </div>

                {r.comment && (
                  <p className="mt-2 line-clamp-3 text-sm text-ink/70">
                    {r.comment}
                  </p>
                )}

                <span className="mt-2 text-xs text-ink/40">
                  {fmtDate(r.createdAt)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}