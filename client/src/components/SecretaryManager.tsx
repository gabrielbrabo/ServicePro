import { useCallback, useEffect, useState } from "react";
import {
  secretaryApi,
  SecretaryMember,
  SecretaryPending,
} from "../api/secretary";

// Gestao de secretarias/atendentes (dono). Uma secretaria organiza a agenda de
// todos (ver/criar/remarcar/cancelar) e fala com clientes, sem prestar servico
// nem ter poderes de dono. A 1a e gratis; da 2a em diante ocupa um assento pago.
export function SecretaryManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [secretaries, setSecretaries] = useState<SecretaryMember[]>([]);
  const [pending, setPending] = useState<SecretaryPending[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inviteUrl: string; emailSent: boolean } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    secretaryApi
      .list(establishmentId)
      .then((r) => {
        setSecretaries(r.secretaries.filter((s) => s.active));
        setPending(r.pending);
      })
      .catch(() => {
        setSecretaries([]);
        setPending([]);
      })
      .finally(() => setLoading(false));
  }, [establishmentId]);

  useEffect(load, [load]);

  const invite = async () => {
    if (!email.trim()) {
      setError("Informe o e-mail do(a) secretário(a).");
      return;
    }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await secretaryApi.invite(establishmentId, email.trim());
      setResult({ inviteUrl: res.inviteUrl, emailSent: res.emailSent });
      setEmail("");
      load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Não foi possível enviar o convite.";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const remove = async (userId: string) => {
    const prev = secretaries;
    setSecretaries((list) => list.filter((s) => s.userId !== userId));
    try {
      await secretaryApi.remove(establishmentId, userId);
    } catch {
      setSecretaries(prev);
      setError("Não foi possível remover o(a) secretário(a).");
    }
  };

  const copyLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h2 className="font-display text-lg font-bold text-ink">
        Secretário(a) / Atendente
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Dê acesso a alguém para organizar a agenda de todos (receber, criar,
        remarcar e cancelar agendamentos e falar com clientes) — sem prestar
        serviço nem mexer em financeiro ou assinatura.
      </p>
      <p className="mt-1 text-xs font-medium text-teal-700">
        O(a) 1º(ª) é grátis. A partir do(a) 2º(ª), cada um(a) ocupa um assento
        (como um funcionário).
      </p>

      {/* Convidar */}
      <div className="mt-4 space-y-3 rounded-xl bg-sand/40 p-4">
        <label className="block text-sm font-medium text-ink">
          E-mail do(a) secretário(a)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="secretaria@email.com"
            className="flex-1 rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            onKeyDown={(e) => e.key === "Enter" && invite()}
          />
          <button
            type="button"
            onClick={invite}
            disabled={sending}
            className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {sending ? "Enviando..." : "Convidar"}
          </button>
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        {result && (
          <div className="space-y-2 rounded-xl bg-teal-500/10 px-3 py-3">
            <p className="text-sm font-medium text-teal-700">
              {result.emailSent
                ? "Convite enviado por e-mail. Você também pode enviar o link abaixo."
                : "Convite criado. Copie o link e envie ao(à) secretário(a) (WhatsApp, etc)."}
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={result.inviteUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs text-ink/70 outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className="rounded-lg bg-amber-400 px-4 text-sm font-semibold text-ink transition hover:bg-amber-500"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="text-ink/50">Carregando...</p>
        ) : secretaries.length === 0 && pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
            Nenhum(a) secretário(a) cadastrado(a) ainda.
          </p>
        ) : (
          <>
            {secretaries.map((s) => (
              <div
                key={s.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-600">
                    {(s.name || s.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-ink">{s.name || s.email}</p>
                    <p className="text-xs text-ink/50">{s.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.userId)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Remover
                </button>
              </div>
            ))}

            {pending.map((p) => (
              <div
                key={p._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-sand/40 p-3"
              >
                <div>
                  <p className="font-medium text-ink">{p.email}</p>
                  <p className="text-xs text-ink/50">Convite pendente</p>
                </div>
                <span className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  Aguardando aceite
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
