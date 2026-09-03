import { useEffect, useState } from "react";
import { anamneseApi, AnamneseSubmission } from "../api/anamnese";

// Aba "Anamnese online" (saúde): mostra o link para o paciente preencher e as
// anamneses recebidas.
export function AnamneseManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [items, setItems] = useState<AnamneseSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const link = `${window.location.origin}/anamnese/${establishmentId}`;

  const load = () => {
    setLoading(true);
    anamneseApi
      .list(establishmentId)
      .then(setItems)
      .catch(() => setError("Não foi possível carregar."))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [establishmentId]);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const remove = async (id: string) => {
    await anamneseApi.remove(establishmentId, id);
    setItems((l) => l.filter((x) => x._id !== id));
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        });
  };

  return (
    <div>
      {/* link de divulgacao */}
      <div className="mb-5 rounded-2xl bg-teal-700 p-4 text-white">
        <p className="text-sm font-medium text-teal-100">
          Link da anamnese — envie ao paciente antes da consulta
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 truncate font-mono text-sm">{link}</p>
          <button
            onClick={copy}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-amber-500"
          >
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      </div>

      <p className="mb-3 text-sm text-ink/60">
        {items.length} anamnese{items.length !== 1 ? "s" : ""} recebida
        {items.length !== 1 ? "s" : ""}
      </p>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
          Nenhuma anamnese recebida ainda. Compartilhe o link acima.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it._id}
              className="rounded-xl border border-ink/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => setOpen(open === it._id ? null : it._id)}
                  className="min-w-0 text-left"
                >
                  <p className="font-medium text-ink">
                    {it.patientName || "Sem nome"}
                  </p>
                  <p className="text-xs text-ink/50">
                    {fmt(it.createdAt)}
                    {it.patientPhone ? ` · ${it.patientPhone}` : ""} ·{" "}
                    {open === it._id ? "ocultar" : "ver respostas"}
                  </p>
                </button>
                <button
                  onClick={() => remove(it._id)}
                  className="shrink-0 text-xs font-medium text-red-500 hover:underline"
                >
                  Remover
                </button>
              </div>
              {open === it._id && (
                <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                  {it.answers.map((a, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-ink/60">
                        {a.question}
                      </p>
                      <p className="text-sm text-ink/80">{a.answer || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
