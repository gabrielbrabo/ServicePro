import { useEffect, useState } from "react";
import { reviewApi, EstablishmentReview } from "../api/review";
import { Stars } from "./Stars";

// Aba "Avaliacoes" do painel: lista todas as avaliacoes recebidas pelo
// estabelecimento (dono/funcionario), com resumo da nota no topo.
export function ReviewsManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [reviews, setReviews] = useState<EstablishmentReview[]>([]);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reviewApi
      .listByEstablishment(establishmentId)
      .then((res) => {
        if (!alive) return;
        setReviews(res.reviews);
        setRatingAvg(res.ratingAvg);
        setRatingCount(res.ratingCount);
      })
      .catch(() => {
        if (alive) setError("Nao foi possivel carregar as avaliacoes.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [establishmentId]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando avaliações...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm font-medium text-red-500">{error}</p>;
  }

  return (
    <div>
      {/* resumo da nota */}
      {ratingCount > 0 && (
        <div className="mb-5 flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5">
          <span className="font-display text-4xl font-bold text-ink">
            {ratingAvg.toFixed(1).replace(".", ",")}
          </span>
          <div>
            <Stars value={ratingAvg} showValue={false} size="md" />
            <p className="mt-1 text-sm text-ink/50">
              {ratingCount} avalia{ratingCount !== 1 ? "ções" : "ção"}
            </p>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-12 text-center text-ink/50">
          Este estabelecimento ainda não recebeu avaliações.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r._id}
              className="rounded-xl border border-ink/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
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
                    <p className="font-medium text-ink">
                      {r.client?.name || "Cliente"}
                    </p>
                    {r.service && (
                      <p className="text-xs text-ink/50">{r.service.title}</p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-ink/40">
                  {fmtDate(r.createdAt)}
                </span>
              </div>

              <div className="mt-2">
                <Stars value={r.rating} showValue={false} />
              </div>

              {r.comment && (
                <p className="mt-2 text-sm text-ink/70">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}