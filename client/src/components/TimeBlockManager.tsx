import { useEffect, useState, useCallback } from "react";
import { scheduleApi, TimeBlock, TimeBlockType } from "../api/schedule";

const TYPE_LABEL: Record<TimeBlockType, string> = {
  bloqueio: "Bloqueio",
  feriado: "Feriado",
  ferias: "Férias",
};

const TYPE_STYLE: Record<TimeBlockType, string> = {
  bloqueio: "bg-amber-400/20 text-amber-700",
  feriado: "bg-teal-50 text-teal-600",
  ferias: "bg-ink/10 text-ink/60",
};

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describe(block: TimeBlock) {
  if (block.allDay) {
    const lastDay = new Date(new Date(block.endAt).getTime() - 86400000);
    const startDay = fmtDate(block.startAt);
    const endDay = fmtDate(lastDay.toISOString());
    return startDay === endDay ? startDay : `${startDay} — ${endDay}`;
  }
  return `${fmtDateTime(block.startAt)} — ${fmtDateTime(block.endAt)}`;
}

export function TimeBlockManager({
  establishmentId,
  professional = null,
}: {
  establishmentId: string;
  professional?: string | null;
}) {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<TimeBlockType>("bloqueio");
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(todayYMD());
  const [endDate, setEndDate] = useState(todayYMD());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    scheduleApi
      .listTimeBlocks(establishmentId)
      .then((all) => {
        // filtra pelo escopo atual: bloqueios do profissional selecionado,
        // ou os do estabelecimento (professional null) quando na agenda geral
        const scoped = all.filter((b) =>
          professional
            ? b.professional === professional
            : !b.professional
        );
        setBlocks(scoped);
      })
      .catch(() => setError("Não foi possível carregar os bloqueios."))
      .finally(() => setLoading(false));
  }, [establishmentId, professional]);

  useEffect(load, [load]);

  const resetForm = () => {
    setType("bloqueio");
    setAllDay(true);
    setStartDate(todayYMD());
    setEndDate(todayYMD());
    setStartTime("09:00");
    setEndTime("12:00");
    setLabel("");
  };

  const submit = async () => {
    setError(null);

    let payload: {
      type: TimeBlockType;
      startAt: string;
      endAt: string;
      allDay: boolean;
      label?: string;
      professional?: string | null;
    };

    if (allDay) {
      if (!startDate || !endDate) {
        setError("Informe as datas de início e fim.");
        return;
      }
      if (endDate < startDate) {
        setError("A data de fim deve ser igual ou posterior à de início.");
        return;
      }
      payload = {
        type,
        startAt: startDate,
        endAt: endDate,
        allDay: true,
        label: label.trim() || undefined,
        professional: professional ?? undefined,
      };
    } else {
      if (!startDate || !startTime || !endTime) {
        setError("Informe data e horários de início e fim.");
        return;
      }
      const startAt = new Date(`${startDate}T${startTime}`);
      const endAt = new Date(`${startDate}T${endTime}`);
      if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
        setError("Data ou horário inválido.");
        return;
      }
      if (endAt <= startAt) {
        setError("O horário de fim deve ser depois do início.");
        return;
      }
      payload = {
        type,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        allDay: false,
        label: label.trim() || undefined,
        professional: professional ?? undefined,
      };
    }

    setSaving(true);
    try {
      const created = await scheduleApi.createTimeBlock(establishmentId, payload);
      setBlocks((b) =>
        [...b, created].sort(
          (x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime()
        )
      );
      resetForm();
    } catch {
      setError("Não foi possível criar o bloqueio.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const prev = blocks;
    setBlocks((b) => b.filter((x) => x._id !== id));
    try {
      await scheduleApi.deleteTimeBlock(establishmentId, id);
    } catch {
      setBlocks(prev);
      setError("Não foi possível remover o bloqueio.");
    }
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h2 className="font-display text-lg font-bold text-ink">
        Bloqueios e feriados
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Marque datas ou horários em que não haverá atendimento. Esses períodos
        somem automaticamente da agenda dos clientes.
      </p>

      <div className="mt-5 space-y-4 rounded-xl bg-sand/40 p-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Tipo
          </label>
          <div className="flex gap-2">
            {(["bloqueio", "feriado", "ferias"] as TimeBlockType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  type === t
                    ? "border-teal-500 bg-teal-500 text-white"
                    : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 rounded border-ink/30 text-teal-500 focus:ring-teal-500"
          />
          Dia(s) inteiro(s)
        </label>

        {allDay ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Fim
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Data
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Das
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Às
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Descrição (opcional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Feriado municipal, viagem, reunião"
            className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
        >
          {saving ? "Adicionando..." : "Adicionar bloqueio"}
        </button>
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="text-ink/50">Carregando...</p>
        ) : blocks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
            Nenhum bloqueio cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {blocks.map((b) => (
              <div
                key={b._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLE[b.type]}`}
                  >
                    {TYPE_LABEL[b.type]}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {describe(b)}
                    </p>
                    {b.label && (
                      <p className="text-xs text-ink/50">{b.label}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(b._id)}
                  className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand hover:text-red-600"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}