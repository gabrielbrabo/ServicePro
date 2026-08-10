import { useEffect, useMemo, useState } from "react";
import {
  scheduleApi,
  WorkingHour,
  Break,
} from "../api/schedule";
import { DAYS, minutesToTime, timeToMinutes } from "../lib/time";
import { TimeBlockManager } from "./TimeBlockManager";

interface DayConfig {
  active: boolean;
  start: string;
  end: string;
}

interface BreakConfig {
  id: string;
  scope: "all" | number; // "all" = todos os dias, ou dayOfWeek
  start: string;
  end: string;
  label: string;
}

const DEFAULT_DAY: DayConfig = { active: false, start: "09:00", end: "18:00" };

const ADVANCE_PRESETS = [
  { label: "Sem mínimo", value: 0 },
  { label: "30 minutos", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "2 horas", value: 120 },
  { label: "24 horas", value: 1440 },
];

const FUTURE_PRESETS = [
  { label: "15 dias", value: 15 },
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
  { label: "90 dias", value: 90 },
];

let breakCounter = 0;
const newBreakId = () => `brk_${Date.now()}_${breakCounter++}`;

// Agenda de UM estabelecimento ou de UM profissional (quando professional vem).
export function AvailabilityEditor({
  establishmentId,
  professional = null,
}: {
  establishmentId: string;
  professional?: string | null;
}) {
  const [days, setDays] = useState<DayConfig[]>(
    Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY }))
  );
  const [breaks, setBreaks] = useState<BreakConfig[]>([]);
  const [minAdvance, setMinAdvance] = useState(30);
  const [maxFuture, setMaxFuture] = useState(30);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    scheduleApi
      .getAvailability(establishmentId, professional)
      .then((data) => {
        const next = Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY }));
        (data.workingHours || []).forEach((s) => {
          next[s.dayOfWeek] = {
            active: true,
            start: minutesToTime(s.startMinute),
            end: minutesToTime(s.endMinute),
          };
        });
        setDays(next);
        setBreaks(
          (data.breaks || []).map((b) => ({
            id: newBreakId(),
            scope: b.dayOfWeek === null ? "all" : b.dayOfWeek,
            start: minutesToTime(b.startMinute),
            end: minutesToTime(b.endMinute),
            label: b.label || "",
          }))
        );
        setMinAdvance(data.minAdvanceMinutes ?? 30);
        setMaxFuture(data.maxFutureDays ?? 30);
      })
      .catch(() => setError("Não foi possível carregar a agenda."))
      .finally(() => setLoading(false));
  }, [establishmentId, professional]);

  // ---- dias de funcionamento ----
  const toggleDay = (i: number) =>
    setDays((d) =>
      d.map((day, idx) => (idx === i ? { ...day, active: !day.active } : day))
    );

  const setDayField = (i: number, field: "start" | "end", value: string) =>
    setDays((d) =>
      d.map((day, idx) => (idx === i ? { ...day, [field]: value } : day))
    );

  const copyToAll = () => {
    const source = days.find((d) => d.active);
    if (!source) return;
    setDays((d) =>
      d.map((day) =>
        day.active ? { ...day, start: source.start, end: source.end } : day
      )
    );
  };

  const setWeekdays = () => {
    const source = days.find((d) => d.active) || DEFAULT_DAY;
    setDays((d) =>
      d.map((day, i) =>
        i >= 1 && i <= 5
          ? { active: true, start: source.start, end: source.end }
          : { ...day, active: false }
      )
    );
  };

  // ---- intervalos ----
  const addBreak = () =>
    setBreaks((b) => [
      ...b,
      { id: newBreakId(), scope: "all", start: "12:00", end: "13:00", label: "Almoço" },
    ]);

  const removeBreak = (id: string) =>
    setBreaks((b) => b.filter((x) => x.id !== id));

  const setBreakField = (
    id: string,
    field: keyof BreakConfig,
    value: string | number
  ) =>
    setBreaks((b) =>
      b.map((x) => (x.id === id ? { ...x, [field]: value } : x))
    );

  // ---- validação ----
  const dayErrors = useMemo(
    () =>
      days.map(
        (d) =>
          d.active && timeToMinutes(d.end) <= timeToMinutes(d.start)
      ),
    [days]
  );

  const breakErrors = useMemo(
    () =>
      breaks.map((br) => {
        if (timeToMinutes(br.end) <= timeToMinutes(br.start)) return true;
        const targetDays =
          br.scope === "all"
            ? days.map((d, i) => ({ d, i })).filter(({ d }) => d.active)
            : days[br.scope as number]?.active
            ? [{ d: days[br.scope as number], i: br.scope as number }]
            : [];
        if (targetDays.length === 0) return false;
        const bs = timeToMinutes(br.start);
        const be = timeToMinutes(br.end);
        return targetDays.some(
          ({ d }) =>
            bs < timeToMinutes(d.start) || be > timeToMinutes(d.end)
        );
      }),
    [breaks, days]
  );

  const hasError = dayErrors.some(Boolean) || breakErrors.some(Boolean);

  const activeDayCount = days.filter((d) => d.active).length;

  // ---- salvar ----
  const save = async () => {
    if (hasError) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    const workingHours: WorkingHour[] = days
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d.active)
      .map(({ d, i }) => ({
        dayOfWeek: i,
        startMinute: timeToMinutes(d.start),
        endMinute: timeToMinutes(d.end),
      }));

    const breaksPayload: Break[] = breaks.map((br) => ({
      dayOfWeek: br.scope === "all" ? null : (br.scope as number),
      startMinute: timeToMinutes(br.start),
      endMinute: timeToMinutes(br.end),
      label: br.label.trim(),
    }));

    try {
      await scheduleApi.setAvailability(
        establishmentId,
        {
          workingHours,
          breaks: breaksPayload,
          minAdvanceMinutes: minAdvance,
          maxFutureDays: maxFuture,
        },
        professional
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando agenda...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Horário de funcionamento */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              Horário de funcionamento
            </h3>
            <p className="text-sm text-ink/50">
              Marque os dias abertos e defina o intervalo de atendimento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={setWeekdays}
              className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:border-teal-500 hover:text-teal-600"
            >
              Seg a Sex
            </button>
            <button
              onClick={copyToAll}
              disabled={activeDayCount < 2}
              className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:border-teal-500 hover:text-teal-600 disabled:opacity-40 disabled:hover:border-ink/15 disabled:hover:text-ink/70"
            >
              Copiar 1º horário p/ todos
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {days.map((day, i) => (
            <div
              key={i}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition ${
                dayErrors[i]
                  ? "border-red-400/60 bg-red-50/50"
                  : day.active
                  ? "border-teal-500/40 bg-teal-50/50"
                  : "border-ink/10 bg-white"
              }`}
            >
              <button
                onClick={() => toggleDay(i)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  day.active ? "bg-teal-500" : "bg-ink/20"
                }`}
                aria-pressed={day.active}
                aria-label={`Ativar ${DAYS[i]}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    day.active ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>

              <span className="w-20 font-medium text-ink">{DAYS[i]}</span>

              {day.active ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) => setDayField(i, "start", e.target.value)}
                    className="rounded-lg border border-ink/15 bg-white px-2 py-1.5 outline-none focus:border-teal-500"
                  />
                  <span className="text-ink/40">até</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) => setDayField(i, "end", e.target.value)}
                    className="rounded-lg border border-ink/15 bg-white px-2 py-1.5 outline-none focus:border-teal-500"
                  />
                  {dayErrors[i] && (
                    <span className="text-xs font-medium text-red-500">
                      Fim deve ser depois do início
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-ink/40">Fechado</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 2. Intervalos */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">Intervalos</h3>
            <p className="text-sm text-ink/50">
              Períodos bloqueados para agendamento (almoço, café, etc).
            </p>
          </div>
          <button
            onClick={addBreak}
            className="rounded-lg bg-teal-500/10 px-3 py-1.5 text-sm font-semibold text-teal-600 transition hover:bg-teal-500/20"
          >
            + Adicionar intervalo
          </button>
        </div>

        {breaks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/15 p-4 text-center text-sm text-ink/40">
            Nenhum intervalo. O atendimento fica contínuo dentro do expediente.
          </p>
        ) : (
          <div className="space-y-2">
            {breaks.map((br, idx) => (
              <div
                key={br.id}
                className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${
                  breakErrors[idx]
                    ? "border-red-400/60 bg-red-50/50"
                    : "border-ink/10 bg-white"
                }`}
              >
                <input
                  type="text"
                  value={br.label}
                  onChange={(e) =>
                    setBreakField(br.id, "label", e.target.value)
                  }
                  placeholder="Nome (ex: Almoço)"
                  className="w-32 rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                />
                <select
                  value={br.scope}
                  onChange={(e) =>
                    setBreakField(
                      br.id,
                      "scope",
                      e.target.value === "all" ? "all" : Number(e.target.value)
                    )
                  }
                  className="rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                >
                  <option value="all">Todos os dias</option>
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={br.start}
                  onChange={(e) =>
                    setBreakField(br.id, "start", e.target.value)
                  }
                  className="rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                />
                <span className="text-ink/40">até</span>
                <input
                  type="time"
                  value={br.end}
                  onChange={(e) => setBreakField(br.id, "end", e.target.value)}
                  className="rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                />
                <button
                  onClick={() => removeBreak(br.id)}
                  className="ml-auto rounded-lg px-2 py-1.5 text-sm text-red-500 transition hover:bg-red-50"
                  aria-label="Remover intervalo"
                >
                  Remover
                </button>
                {breakErrors[idx] && (
                  <span className="w-full text-xs font-medium text-red-500">
                    Intervalo inválido ou fora do horário de funcionamento
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Antecedência mínima */}
      <section>
        <h3 className="text-lg font-semibold text-ink">Antecedência mínima</h3>
        <p className="mb-3 text-sm text-ink/50">
          Tempo mínimo entre agora e o horário agendado.
        </p>
        <div className="flex flex-wrap gap-2">
          {ADVANCE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setMinAdvance(p.value)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                minAdvance === p.value
                  ? "border-teal-500 bg-teal-500 text-white"
                  : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* 4. Janela de dias futuros */}
      <section>
        <h3 className="text-lg font-semibold text-ink">
          Até quando aceitar agendamentos
        </h3>
        <p className="mb-3 text-sm text-ink/50">
          Quantos dias no futuro o cliente pode reservar.
        </p>
        <div className="flex flex-wrap gap-2">
          {FUTURE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setMaxFuture(p.value)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                maxFuture === p.value
                  ? "border-teal-500 bg-teal-500 text-white"
                  : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* 5. Bloqueios e feriados (datas específicas) */}
      <TimeBlockManager
        establishmentId={establishmentId}
        professional={professional}
      />

      {/* Resumo + salvar */}
      <div className="sticky bottom-0 -mx-1 rounded-t-2xl border-t border-ink/10 bg-white/80 px-1 pt-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/60">
          <span>
            <strong className="text-ink">{activeDayCount}</strong> dia(s) aberto(s)
          </span>
          <span>
            <strong className="text-ink">{breaks.length}</strong> intervalo(s)
          </span>
          <span>
            Antecedência:{" "}
            <strong className="text-ink">
              {ADVANCE_PRESETS.find((p) => p.value === minAdvance)?.label ||
                `${minAdvance} min`}
            </strong>
          </span>
          <span>
            Até <strong className="text-ink">{maxFuture} dias</strong> à frente
          </span>
        </div>

        <div className="flex items-center gap-3 pb-4">
          <button
            onClick={save}
            disabled={saving || hasError}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar agenda"}
          </button>
          {hasError && (
            <span className="text-sm font-medium text-red-500">
              Corrija os campos destacados
            </span>
          )}
          {saved && (
            <span className="text-sm font-medium text-teal-600">
              Agenda salva ✓
            </span>
          )}
          {error && (
            <span className="text-sm font-medium text-red-500">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}