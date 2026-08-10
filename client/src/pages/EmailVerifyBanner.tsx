import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth";

export function EmailVerifyBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // so aparece para logado, nao verificado e que nao dispensou nesta sessao
  if (!user || user.emailVerified || dismissed) return null;

  const resend = async () => {
    setSending(true);
    setMessage(null);
    try {
      const res = await authApi.resendVerification();
      setMessage(res.message);
    } catch {
      setMessage("Não foi possível reenviar agora. Tente mais tarde.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-b border-amber-400/40 bg-amber-400/15">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5">
        <p className="min-w-0 flex-1 text-sm text-ink/80">
          <strong className="font-semibold">Confirme seu e-mail</strong> para
          receber lembretes e avisos de agendamento.
          {message && (
            <span className="ml-1 font-medium text-teal-700">{message}</span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={resend}
            disabled={sending}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-amber-500 disabled:opacity-60"
          >
            {sending ? "Enviando..." : "Reenviar link"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-ink/50 transition hover:text-ink"
            aria-label="Dispensar"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}