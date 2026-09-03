import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { reviewApi } from "../api/review";
import { Logo } from "../components/Logo";

// ---------------------------------------------------------------------------
// Pagina PUBLICA de avaliacao em 1 TOQUE (sem login). Aberta pelo link/QR
// enviado apos o atendimento: o cliente toca numa estrela e a nota ja e
// gravada; o comentario e opcional depois.
// ---------------------------------------------------------------------------

interface Info {
  establishmentName: string;
  serviceTitle: string;
  professionalName: string | null;
  canReview: boolean;
  currentRating: number | null;
  currentComment: string;
}

export function ReviewPublicPage() {
  const { token = "" } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false); // nota ja gravada
  const [sendingComment, setSendingComment] = useState(false);
  const [commentDone, setCommentDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    reviewApi
      .getByToken(token)
      .then((d) => {
        setInfo(d);
        if (d.currentRating) setRating(d.currentRating);
        if (d.currentComment) setComment(d.currentComment);
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  // grava a nota assim que o cliente toca numa estrela (1 toque)
  const pick = async (stars: number) => {
    setRating(stars);
    setError("");
    try {
      await reviewApi.submitByToken(token, stars, comment || undefined);
      setSaved(true);
    } catch {
      setError("Não foi possível registrar sua nota. Tente novamente.");
      setSaved(false);
    }
  };

  const sendComment = async () => {
    if (!rating) return;
    setSendingComment(true);
    setError("");
    try {
      await reviewApi.submitByToken(token, rating, comment || undefined);
      setCommentDone(true);
    } catch {
      setError("Não foi possível enviar o comentário.");
    } finally {
      setSendingComment(false);
    }
  };

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-sand text-ink/50">
        Carregando...
      </div>
    );

  if (invalid || !info)
    return (
      <div className="grid min-h-screen place-items-center bg-sand p-6 text-center text-ink/60">
        Link de avaliação inválido ou expirado.
      </div>
    );

  const shown = hover || rating;

  return (
    <div className="min-h-screen bg-sand py-10">
      <div className="mx-auto w-full max-w-md px-4">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-ink/10 bg-white p-6 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            {info.establishmentName}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Como foi seu <strong>{info.serviceTitle}</strong>
            {info.professionalName ? ` com ${info.professionalName}` : ""}?
          </p>

          {/* estrelas — tocar grava na hora */}
          <div className="mt-6 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => pick(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${s} estrela${s > 1 ? "s" : ""}`}
                className="text-4xl leading-none transition-transform hover:scale-110"
                style={{ color: s <= shown ? "#f59e0b" : "#cbd5e1" }}
              >
                ★
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {saved && !commentDone && (
            <div className="mt-6 text-left">
              <p className="mb-3 text-center text-sm font-medium text-teal-600">
                ✓ Nota registrada, obrigado!
              </p>
              <label className="mb-1 block text-sm font-medium text-ink/70">
                Quer deixar um comentário? (opcional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Conte como foi sua experiência…"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <button
                onClick={sendComment}
                disabled={sendingComment}
                className="mt-3 h-11 w-full rounded-xl bg-teal-500 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {sendingComment ? "Enviando…" : "Enviar comentário"}
              </button>
            </div>
          )}

          {commentDone && (
            <div className="mt-6">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-teal-500 text-2xl text-white">
                ✓
              </div>
              <p className="font-medium text-ink">
                Avaliação enviada. Muito obrigado!
              </p>
            </div>
          )}

          {!saved && !info.canReview && (
            <p className="mt-4 text-xs text-ink/40">
              Este atendimento ainda não foi concluído.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
