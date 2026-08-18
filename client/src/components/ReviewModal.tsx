import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { reviewApi } from "../api/review";

// Modal de avaliacao: estrelas clicaveis (1..5) + comentario opcional.
// Abre a partir da notificacao "Avalie seu atendimento". Ao montar, busca uma
// avaliacao existente para o agendamento (para permitir rever/editar).
export function ReviewModal({
  bookingId,
  establishmentName,
  serviceTitle,
  onClose,
  onSubmitted,
}: {
  bookingId: string;
  establishmentName?: string;
  serviceTitle?: string;
  onClose: () => void;
  onSubmitted?: (res: { ratingAvg: number; ratingCount: number }) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // prefill: se ja avaliou este agendamento, carrega a nota/comentario
  useEffect(() => {
    let alive = true;
    setLoading(true);
    reviewApi
      .getByBooking(bookingId)
      .then((r) => {
        if (!alive || !r) return;
        setRating(r.rating);
        setComment(r.comment || "");
      })
      .catch(() => {
        /* silencioso: seguir como avaliacao nova */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bookingId]);

  const submit = async () => {
    if (rating < 1) return;
    setSaving(true);
    setError(null);
    try {
      const res = await reviewApi.submit({
        bookingId,
        rating,
        comment: comment.trim() || undefined,
      });
      setDone(true);
      onSubmitted?.({ ratingAvg: res.ratingAvg, ratingCount: res.ratingCount });
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      setError(
        status === 400
          ? "So e possivel avaliar um atendimento concluido."
          : "Nao foi possivel enviar sua avaliacao. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  };

  const shown = hover || rating;
  const LABELS = ["", "Ruim", "Regular", "Bom", "Muito bom", "Excelente"];

  // Portal no body: evita que a NavBar (com backdrop-blur/transform) "prenda"
  // o position:fixed e deixe o modal cortado no topo da pagina.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between border-b border-ink/10 p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Avalie seu atendimento
            </h2>
            <p className="text-sm text-ink/50">
              {serviceTitle
                ? serviceTitle
                : establishmentName || "Como foi sua experiencia?"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-2xl">
              ★
            </div>
            <h3 className="text-lg font-semibold text-ink">
              Obrigado pela avaliacao!
            </h3>
            <p className="mt-1 text-sm text-ink/60">
              Sua opiniao ajuda outros clientes e o estabelecimento.
            </p>
            <button
              onClick={onClose}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
            >
              Fechar
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 p-8 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando...
          </div>
        ) : (
          <>
            <div className="p-5">
              {/* estrelas clicaveis */}
              <div className="flex flex-col items-center gap-2 py-2">
                <div
                  className="flex items-center gap-1"
                  onMouseLeave={() => setHover(0)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHover(n)}
                      aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                      className={`text-4xl leading-none transition ${
                        n <= shown ? "text-amber-400" : "text-ink/20"
                      } hover:scale-110`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span className="h-5 text-sm font-medium text-ink/60">
                  {LABELS[shown] || "Toque nas estrelas"}
                </span>
              </div>

              {/* comentario opcional */}
              <div className="mt-3">
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Comentario (opcional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Conte como foi o atendimento..."
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>

              {error && (
                <p className="mt-3 text-sm font-medium text-red-500">{error}</p>
              )}
            </div>

            <div className="border-t border-ink/10 p-5">
              <button
                type="button"
                onClick={submit}
                disabled={rating < 1 || saving}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
              >
                {saving ? "Enviando..." : "Enviar avaliacao"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}