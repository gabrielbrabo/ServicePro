import { useEffect, useState, useCallback } from "react";
import { scheduleApi, WaitlistEntry } from "../api/schedule";

const STATUS_LABEL: Record<WaitlistEntry["status"], string> = {
  aguardando: "Aguardando",
  notificado: "Vaga avisada",
  atendido: "Atendido",
  cancelado: "Cancelado",
};

const STATUS_STYLE: Record<WaitlistEntry["status"], string> = {
  aguardando: "bg-amber-400/20 text-amber-700",
  notificado: "bg-teal-50 text-teal-600",
  atendido: "bg-ink/10 text-ink/60",
  cancelado: "bg-red-50 text-red-600",
};

// descreve dia e profissional da entrada
function describeTarget(entry: WaitlistEntry) {
  const dia = entry.targetDate
    ? new Date(entry.targetDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Qualquer dia";

  // resolve nome do profissional pelo establishment populado (se houver)
  let prof = "Qualquer profissional";
  if (entry.professional) {
    const est = entry.establishment as unknown as {
      professionals?: { _id: string; name: string }[];
    };
    const p = est?.professionals?.find(
      (x) => x._id === entry.professional
    );
    prof = p ? p.name : "Profissional escolhido";
  }

  return `${dia} · ${prof}`;
}

export function WaitlistList({
  role,
  establishmentId,
}: {
  role: "client" | "provider";
  establishmentId?: string;
}) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    scheduleApi
      .listWaitlist(role, establishmentId)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [role, establishmentId]);

  useEffect(load, [load]);

  const leave = async (id: string) => {
    const prev = entries;
    setEntries((e) => e.filter((x) => x._id !== id));
    try {
      await scheduleApi.leaveWaitlist(id);
    } catch {
      setEntries(prev);
    }
  };

  if (loading) {
    return <p className="text-ink/50">Carregando...</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 p-12 text-center text-ink/50">
        {role === "client"
          ? "Você não está em nenhuma lista de espera."
          : "Ninguém está na lista de espera no momento."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div
          key={e._id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-ink">
                {e.service?.title}
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}
              >
                {STATUS_LABEL[e.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink/60">
              {describeTarget(e)} ·{" "}
              {role === "client"
                ? e.establishment?.name
                : `cliente ${e.client?.name}`}
            </p>
          </div>

          <button
            onClick={() => leave(e._id)}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand hover:text-red-600"
          >
            {role === "client" ? "Sair da fila" : "Remover"}
          </button>
        </div>
      ))}
    </div>
  );
}