import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { reviewApi, EstablishmentReview } from "../api/review";
import { Stars } from "./Stars";

// Modal que lista as avaliacoes recebidas por um estabelecimento.
// Aberto pelo dono/funcionario (ex.: ao clicar na notificacao "Nova avaliacao").
export function EstablishmentReviewsModal({
  establishmentId,
  onClose,
}: {
  establishmentId: string;
  onClose: () => void;
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between border-b border-ink/10 p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Avaliacoes</h2>
            {ratingCount > 0 ? (
              <div className="mt-1">
                <Stars value={ratingAvg} count={ratingCount} size="sm" />
              </div>
            ) : (
              <p className="text-sm text-ink/50">
                O que seus clientes acham do atendimento.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-ink/50">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
              Carregando...
            </div>
          ) : error ? (
            <p className="text-sm font-medium text-red-500">{error}</p>
          ) : reviews.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/50">
              Nenhuma avaliacao ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div
                  key={r._id}
                  className="rounded-xl border border-ink/10 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* foto do cliente (ou inicial do nome quando nao tem) */}
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
                          <p className="text-xs text-ink/50">
                            {r.service.title}
                          </p>
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
      </div>
    </div>,
    document.body
  );
}