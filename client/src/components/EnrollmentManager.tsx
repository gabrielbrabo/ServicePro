import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import { catalogApi, Service } from "../api/catalog";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import { professionalApi, Professional } from "../api/professional";
import { scheduleApi, Booking } from "../api/schedule";
import { DAYS_SHORT, formatPrice } from "../lib/time";
import { FreeSlotSelect } from "./FreeSlotSelect";

// primeira ocorrencia de `weekday` (0=Dom..6=Sab) em ou apos startYMD, no horario
// hh:mm LOCAL. Retorna Date (o fuso do navegador vira UTC no toISOString()).
function firstOnOrAfter(
  startYMD: string,
  weekday: number,
  hh: number,
  mm: number
): Date {
  const [y, m, d] = startYMD.split("-").map(Number);
  const base = new Date(y, m - 1, d, hh, mm, 0, 0);
  const diff = (weekday - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + diff);
  return base;
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const input =
  "h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";
const lbl = "mb-1 block text-xs font-medium text-ink/60";

export function EnrollmentManager({
  establishment,
}: {
  establishment: Establishment;
}) {
  const establishmentId = establishment._id;
  const [view, setView] = useState<"nova" | "frequencia">("nova");
  const [services, setServices] = useState<Service[]>([]);
  const [students, setStudents] = useState<EstablishmentClient[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [time, setTime] = useState("18:00");
  const [startDate, setStartDate] = useState(todayYMD());
  const [weeks, setWeeks] = useState("4");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      catalogApi.byEstablishment(establishmentId),
      recordApi.clients(establishmentId).catch(() => []),
      professionalApi.list(establishmentId).catch(() => []),
    ])
      .then(([svcs, cls, prs]) => {
        setServices(svcs.filter((s) => s.kind === "aula"));
        setStudents(cls);
        setPros(prs);
      })
      .finally(() => setLoading(false));
  }, [establishmentId]);

  const hasTeam = pros.length > 0;
  const selectedService = useMemo(
    () => services.find((s) => s._id === serviceId) || null,
    [services, serviceId]
  );

  const toggleDay = (d: number) =>
    setWeekdays((list) =>
      list.includes(d) ? list.filter((x) => x !== d) : [...list, d]
    );

  const submit = async () => {
    setError("");
    setResult(null);
    if (!clientId) return setError("Escolha o aluno.");
    if (!serviceId) return setError("Escolha a aula.");
    if (weekdays.length === 0) return setError("Escolha ao menos um dia da semana.");
    if (hasTeam && !professionalId) return setError("Escolha o profissional.");
    const [hh, mm] = time.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return setError("Horário inválido.");
    const weeksN = Math.max(1, Math.floor(Number(weeks) || 0));

    const slots = weekdays
      .map((d) => firstOnOrAfter(startDate, d, hh, mm).toISOString())
      .sort();

    setSaving(true);
    try {
      const r = await scheduleApi.createEnrollment({
        establishmentId,
        serviceId,
        clientId,
        professionalId: hasTeam ? professionalId : null,
        slots,
        weeks: weeksN,
        notes: notes.trim() || undefined,
      });
      setResult({ created: r.createdCount, skipped: r.skippedCount });
      setWeekdays([]);
      setNotes("");
    } catch {
      setError("Não foi possível criar a matrícula.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando...
      </div>
    );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-1 rounded-xl bg-sand/60 p-1">
        {(
          [
            ["nova", "Nova matrícula"],
            ["frequencia", "Frequência"],
          ] as ["nova" | "frequencia", string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              view === k
                ? "bg-white text-teal-600 shadow-sm"
                : "text-ink/60 hover:text-ink/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "frequencia" ? (
        <AttendanceList
          establishmentId={establishmentId}
          aulaIds={services.map((s) => s._id)}
        />
      ) : (
        <>
      <p className="text-sm text-ink/60">
        Matricule um aluno numa série recorrente (mesmos horários toda semana).
        Os agendamentos entram confirmados na agenda.
      </p>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/50">
          Nenhum serviço marcado como <strong>Aula</strong>. Vá em Serviços,
          edite o serviço e defina o modelo como "Aula".
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>Aluno</span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={input}
              >
                <option value="">Selecione...</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {students.length === 0 && (
                <span className="mt-1 block text-xs text-ink/40">
                  Só aparecem alunos que já têm atendimento aqui.
                </span>
              )}
            </label>
            <label className="block">
              <span className={lbl}>Aula</span>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className={input}
              >
                <option value="">Selecione...</option>
                {services.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.title}
                    {s.classMode === "turma" ? " (turma)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasTeam && (
            <label className="block">
              <span className={lbl}>Profissional</span>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className={input}
              >
                <option value="">Selecione...</option>
                {pros.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <span className={lbl}>Dias da semana</span>
            <div className="flex flex-wrap gap-2">
              {DAYS_SHORT.map((d, i) => {
                const on = weekdays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      on
                        ? "border-teal-500 bg-teal-500 text-white"
                        : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={lbl}>Horário</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Início</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Semanas</span>
              <input
                type="number"
                min="1"
                max="53"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                className={input}
              />
            </label>
          </div>

          <label className="block">
            <span className={lbl}>Observações (opcional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={input}
            />
          </label>

          {selectedService?.billing === "mensal" && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Esta aula é cobrada por mês. A cobrança mensal/frequência entra na
              próxima etapa; por ora a série ocupa a agenda normalmente.
            </p>
          )}

          {weekdays.length > 0 && (
            <p className="text-xs text-ink/50">
              Serão criados {weekdays.length} horário(s) por semana ×{" "}
              {Math.max(1, Math.floor(Number(weeks) || 0))} semana(s) ={" "}
              <strong>
                {weekdays.length * Math.max(1, Math.floor(Number(weeks) || 0))}{" "}
                aulas
              </strong>
              .
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {result && (
            <p className="rounded-lg bg-teal-500/10 px-3 py-2 text-sm text-teal-700 dark:text-teal-100">
              Matrícula criada: {result.created} aula(s) agendada(s)
              {result.skipped > 0
                ? ` · ${result.skipped} pulada(s) por conflito/indisponibilidade`
                : ""}
              .
            </p>
          )}

          <button
            onClick={submit}
            disabled={saving}
            className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar matrícula"}
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// ---- Frequência: sessões recorrentes com marcação de presença ----
const ATT: { key: "presente" | "falta" | "reposicao"; label: string; cls: string }[] = [
  { key: "presente", label: "Presente", cls: "bg-emerald-500 text-white" },
  { key: "falta", label: "Falta", cls: "bg-red-500 text-white" },
  { key: "reposicao", label: "Reposição", cls: "bg-amber-500 text-white" },
];

interface Serie {
  seriesId: string;
  clientName: string;
  serviceTitle: string;
  clientId: string;
  serviceId: string;
  professionalId: string | null;
  sessions: Booking[];
}

function AttendanceList({
  establishmentId,
  aulaIds,
}: {
  establishmentId: string;
  aulaIds: string[];
}) {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addDate, setAddDate] = useState("");
  const [addTime, setAddTime] = useState("18:00");

  const reload = () => {
    setLoading(true);
    scheduleApi
      .listBookings("provider", establishmentId)
      .then((list) =>
        setItems(
          list
            .filter((b) => b.status !== "cancelado")
            .sort(
              (a, b) =>
                new Date(a.scheduledAt).getTime() -
                new Date(b.scheduledAt).getTime()
            )
        )
      )
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [establishmentId]);

  // alunos que agendaram uma AULA por conta propria, sem matricula (sem série)
  const semMatricula = useMemo(() => {
    const set = new Set(aulaIds);
    // quem JA tem matricula (qualquer booking com série) nao entra no alerta
    const enrolled = new Set<string>();
    for (const b of items)
      if (b.seriesId && b.client?._id) enrolled.add(b.client._id);
    const names = new Map<string, string>();
    for (const b of items) {
      if (
        !b.seriesId &&
        b.service?._id &&
        set.has(b.service._id) &&
        b.client?._id &&
        !enrolled.has(b.client._id)
      ) {
        names.set(b.client._id, b.client.name || "Aluno");
      }
    }
    return Array.from(names.values());
  }, [items, aulaIds]);

  // agrupa por série (matrícula)
  const series = useMemo(() => {
    const map = new Map<string, Serie>();
    for (const b of items) {
      if (!b.seriesId) continue;
      const sid = b.seriesId as string;
      if (!map.has(sid))
        map.set(sid, {
          seriesId: sid,
          clientName: b.client?.name || "Aluno",
          serviceTitle: b.service?.title || "Aula",
          clientId: b.client?._id || "",
          serviceId: b.service?._id || "",
          professionalId: b.professional ?? null,
          sessions: [],
        });
      map.get(sid)!.sessions.push(b);
    }
    return Array.from(map.values());
  }, [items]);

  const mark = async (
    b: Booking,
    value: "presente" | "falta" | "reposicao"
  ) => {
    const next = b.attendance === value ? "pendente" : value;
    setItems((list) =>
      list.map((x) => (x._id === b._id ? { ...x, attendance: next } : x))
    );
    try {
      await scheduleApi.markAttendance(b._id, next);
    } catch {
      setItems((list) =>
        list.map((x) =>
          x._id === b._id ? { ...x, attendance: b.attendance } : x
        )
      );
    }
  };

  const cancelSession = async (b: Booking) => {
    if (!confirm("Cancelar esta aula?")) return;
    setItems((list) => list.filter((x) => x._id !== b._id));
    try {
      await scheduleApi.updateStatus(b._id, "cancelado");
    } catch {
      reload();
    }
  };

  const addSession = async (s: Serie) => {
    if (!addDate) return;
    const iso = new Date(`${addDate}T${addTime}`).toISOString();
    try {
      await scheduleApi.createEnrollment({
        establishmentId,
        serviceId: s.serviceId,
        clientId: s.clientId,
        professionalId: s.professionalId,
        slots: [iso],
        weeks: 1,
        seriesId: s.seriesId,
      });
      setAddingId(null);
      setAddDate("");
      reload();
    } catch {
      reload();
    }
  };

  const cancelSerie = async (s: Serie) => {
    if (!confirm(`Cancelar a matrícula inteira de ${s.clientName}?`)) return;
    setItems((list) => list.filter((x) => x.seriesId !== s.seriesId));
    try {
      await scheduleApi.cancelSeries(s.seriesId);
    } catch {
      reload();
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando...
      </div>
    );

  const alertBlock =
    semMatricula.length > 0 ? (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="font-semibold">⚠️ Alunos sem matrícula:</span>{" "}
        {semMatricula.join(", ")} agendaram aula avulsa. Faça a matrícula para
        garantir o horário fixo deles.
      </div>
    ) : null;

  if (series.length === 0)
    return (
      <div className="space-y-4">
        {alertBlock}
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/50">
          Nenhuma aula recorrente. Crie uma matrícula primeiro.
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      {alertBlock}
      {series.map((s) => (
        <div
          key={s.seriesId}
          className="rounded-2xl border border-ink/10 bg-white p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display font-bold text-ink">
                {s.clientName}
              </p>
              <p className="text-xs text-ink/50">
                {s.serviceTitle} · {s.sessions.length} aula(s)
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() =>
                  setAddingId(addingId === s.seriesId ? null : s.seriesId)
                }
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-teal-600 transition hover:bg-teal-50"
              >
                + Aula
              </button>
              <button
                onClick={() => cancelSerie(s)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
              >
                Cancelar matrícula
              </button>
            </div>
          </div>

          {addingId === s.seriesId && (
            <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-ink/10 bg-sand/40 p-2.5">
              <label className="block">
                <span className="mb-1 block text-xs text-ink/60">Data</span>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => {
                    setAddDate(e.target.value);
                    setAddTime("");
                  }}
                  className="h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink/60">
                  Horário livre
                </span>
                <FreeSlotSelect
                  serviceId={s.serviceId}
                  date={addDate}
                  professionalId={s.professionalId}
                  value={addTime}
                  onChange={setAddTime}
                  className="h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <button
                onClick={() => addSession(s)}
                disabled={!addDate || !addTime}
                className="h-9 rounded-lg bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          )}
          <div className="space-y-2">
            {s.sessions.map((b) => (
              <div
                key={b._id}
                className="rounded-xl border border-ink/10 bg-sand/40 p-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ink/80">{fmt(b.scheduledAt)}</p>
                    <p className="text-xs text-ink/40">
                      {b.payment?.amount > 0
                        ? formatPrice(b.payment.amount)
                        : "R$ 0,00 (incluído no plano)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {ATT.map((a) => (
                      <button
                        key={a.key}
                        onClick={() => mark(b, a.key)}
                        className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                          b.attendance === a.key
                            ? a.cls
                            : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                    <button
                      onClick={() => cancelSession(b)}
                      className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
                      aria-label="Cancelar aula"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
