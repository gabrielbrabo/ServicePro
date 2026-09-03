import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import {
  acupunctureApi,
  AcupunctureProfile,
  AcupunctureSession,
  Point,
  ProfilePayload,
  POINT_METHODS,
  methodLabel,
  STIMULATIONS,
  SIDES,
  COMMON_POINTS,
} from "../api/acupuncture";
import { ReturnScheduler } from "./ReturnScheduler";

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const input =
  "h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";
const area =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500";
const lbl = "mb-1 block text-xs font-medium text-ink/60";
const primaryBtn =
  "h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60";

// ============ ENTRADA ============
export function AcupunturaManager({
  establishment,
}: {
  establishment: Establishment;
}) {
  const establishmentId = establishment._id;
  const [patients, setPatients] = useState<EstablishmentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EstablishmentClient | null>(null);

  useEffect(() => {
    setLoading(true);
    recordApi
      .clients(establishmentId)
      .then(setPatients)
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((s) => s.name.toLowerCase().includes(q));
  }, [patients, query]);

  if (selected) {
    return (
      <PatientPanel
        establishmentId={establishmentId}
        patient={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar paciente pelo nome..."
        className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500"
      />
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando pacientes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            {patients.length === 0
              ? "Nenhum paciente ainda. A ficha fica disponível para quem já teve atendimento aqui."
              : "Nenhum paciente encontrado com esse nome."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <button
                key={s._id}
                onClick={() => setSelected(s)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3 text-left transition hover:border-teal-500/40 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {s.avatar ? (
                    <img
                      src={s.avatar}
                      alt={s.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-600">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-ink/50">
                      {s.bookingCount} atendimento
                      {s.bookingCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-teal-600">
                  Abrir →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ PAINEL DO PACIENTE ============
type PatientView = "ficha" | "sessoes" | "evolucao";

function PatientPanel({
  establishmentId,
  patient,
  onBack,
}: {
  establishmentId: string;
  patient: EstablishmentClient;
  onBack: () => void;
}) {
  const clientId = patient._id;
  const [view, setView] = useState<PatientView>("ficha");
  const [sessions, setSessions] = useState<AcupunctureSession[]>([]);
  const [loadingS, setLoadingS] = useState(true);
  const [contra, setContra] = useState("");

  useEffect(() => {
    setLoadingS(true);
    acupunctureApi
      .listSessions(establishmentId, clientId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadingS(false));
    acupunctureApi
      .getProfile(establishmentId, clientId)
      .then((p) => setContra(p.contraindications || ""))
      .catch(() => setContra(""));
  }, [establishmentId, clientId]);

  const last = sessions[0];
  const tabs: [PatientView, string][] = [
    ["ficha", "Ficha"],
    ["sessoes", "Sessões"],
    ["evolucao", "Evolução"],
  ];

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:underline"
      >
        ← Voltar aos pacientes
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">
          {patient.name}
        </h2>
        {last && (
          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/50">
            Última: {fmtDate(last.date)}
          </span>
        )}
      </div>
      {contra && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <span aria-hidden="true">⚠️</span>
          <span>Contraindicações: {contra}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1 border-b border-ink/10">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              view === key
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-ink/50 hover:text-ink/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {view === "ficha" && (
          <ProfileSection
            establishmentId={establishmentId}
            clientId={clientId}
            onContra={setContra}
          />
        )}
        {view === "sessoes" && (
          <SessionsSection
            establishmentId={establishmentId}
            clientId={clientId}
            items={sessions}
            loading={loadingS}
            setItems={setSessions}
          />
        )}
        {view === "evolucao" && (
          <EvolutionSection items={sessions} loading={loadingS} />
        )}
      </div>
    </div>
  );
}

// ============ FICHA ============
function ProfileSection({
  establishmentId,
  clientId,
  onContra,
}: {
  establishmentId: string;
  clientId: string;
  onContra?: (v: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [f, setF] = useState({
    mainComplaint: "",
    tcmPattern: "",
    tongue: "",
    pulse: "",
    contraindications: "",
    healthNotes: "",
  });

  useEffect(() => {
    setLoading(true);
    acupunctureApi
      .getProfile(establishmentId, clientId)
      .then((p: AcupunctureProfile) =>
        setF({
          mainComplaint: p.mainComplaint || "",
          tcmPattern: p.tcmPattern || "",
          tongue: p.tongue || "",
          pulse: p.pulse || "",
          contraindications: p.contraindications || "",
          healthNotes: p.healthNotes || "",
        })
      )
      .catch(() => setError("Não foi possível carregar a ficha."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const payload: ProfilePayload = {
        mainComplaint: f.mainComplaint.trim(),
        tcmPattern: f.tcmPattern.trim(),
        tongue: f.tongue.trim(),
        pulse: f.pulse.trim(),
        contraindications: f.contraindications.trim(),
        healthNotes: f.healthNotes.trim(),
      };
      await acupunctureApi.updateProfile(establishmentId, clientId, payload);
      onContra?.(f.contraindications.trim());
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch {
      setError("Não foi possível salvar a ficha.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando ficha...
      </div>
    );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <label className="block">
          <span className={lbl}>Queixa principal</span>
          <textarea
            value={f.mainComplaint}
            onChange={(e) => set("mainComplaint", e.target.value)}
            rows={2}
            className={area}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Diagnóstico / padrão MTC</span>
          <textarea
            value={f.tcmPattern}
            onChange={(e) => set("tcmPattern", e.target.value)}
            rows={2}
            placeholder="Ex: deficiência de Qi do Baço, estagnação de Qi do Fígado"
            className={area}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Língua</span>
            <input
              value={f.tongue}
              onChange={(e) => set("tongue", e.target.value)}
              placeholder="Ex: pálida, saburra branca"
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Pulso</span>
            <input
              value={f.pulse}
              onChange={(e) => set("pulse", e.target.value)}
              placeholder="Ex: fino, profundo"
              className={input}
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className={lbl}>Contraindicações</span>
          <input
            value={f.contraindications}
            onChange={(e) => set("contraindications", e.target.value)}
            placeholder="Ex: gestante, marca-passo (evitar eletro)"
            className={input}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Observações</span>
          <textarea
            value={f.healthNotes}
            onChange={(e) => set("healthNotes", e.target.value)}
            rows={2}
            className={area}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={primaryBtn}>
          {saving ? "Salvando..." : "Salvar ficha"}
        </button>
        {ok && <span className="text-sm font-medium text-teal-600">Salvo!</span>}
      </div>
    </div>
  );
}

// ============ SESSÕES (pontos aplicados) ============
const emptyPoint = (): Point => ({
  point: "",
  side: "",
  method: "agulha",
  stimulation: "",
  note: "",
});
interface SessionForm {
  date: string;
  eva: string;
  retentionMin: string;
  tcmNotes: string;
  points: Point[];
  recommendations: string;
  notes: string;
  nextVisit: string;
}
const emptySessionForm = (): SessionForm => ({
  date: toDateInput(new Date()),
  eva: "",
  retentionMin: "",
  tcmNotes: "",
  points: [],
  recommendations: "",
  notes: "",
  nextVisit: "",
});

function SessionsSection({
  establishmentId,
  clientId,
  items,
  loading,
  setItems,
}: {
  establishmentId: string;
  clientId: string;
  items: AcupunctureSession[];
  loading: boolean;
  setItems: React.Dispatch<React.SetStateAction<AcupunctureSession[]>>;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SessionForm>(emptySessionForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setForm(emptySessionForm());
    setEditing("new");
    setError(null);
  };
  const openEdit = (s: AcupunctureSession) => {
    setForm({
      date: toDateInput(new Date(s.date)),
      eva: s.eva ? String(s.eva) : "",
      retentionMin: s.retentionMin ? String(s.retentionMin) : "",
      tcmNotes: s.tcmNotes || "",
      points: s.points.map((p) => ({ ...p })),
      recommendations: s.recommendations || "",
      notes: s.notes || "",
      nextVisit: s.nextVisit ? toDateInput(new Date(s.nextVisit)) : "",
    });
    setEditing(s._id);
    setError(null);
  };
  const cancel = () => {
    setEditing(null);
    setForm(emptySessionForm());
  };

  const addPoint = () =>
    setForm((f) => ({ ...f, points: [...f.points, emptyPoint()] }));
  const setPoint = (i: number, k: keyof Point, v: string) =>
    setForm((f) => {
      const points = [...f.points];
      points[i] = { ...points[i], [k]: v };
      return { ...f, points };
    });
  const removePoint = (i: number) =>
    setForm((f) => ({ ...f, points: f.points.filter((_, idx) => idx !== i) }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      date: form.date || undefined,
      eva: Number(form.eva) || 0,
      retentionMin: Number(form.retentionMin) || 0,
      tcmNotes: form.tcmNotes.trim(),
      points: form.points.filter((p) => p.point.trim() !== ""),
      recommendations: form.recommendations.trim(),
      notes: form.notes.trim(),
      nextVisit: form.nextVisit || null,
    };
    try {
      if (editing && editing !== "new") {
        const updated = await acupunctureApi.updateSession(
          establishmentId,
          clientId,
          editing,
          payload
        );
        setItems((list) =>
          list
            .map((x) => (x._id === editing ? updated : x))
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );
      } else {
        const created = await acupunctureApi.createSession(
          establishmentId,
          clientId,
          payload
        );
        setItems((list) =>
          [created, ...list].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        );
      }
      cancel();
    } catch {
      setError("Não foi possível salvar a sessão.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: AcupunctureSession) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== s._id));
    try {
      await acupunctureApi.removeSession(establishmentId, clientId, s._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover a sessão.");
    }
  };

  if (editing) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={lbl}>Data</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Dor (EVA 0-10)</span>
              <input
                type="number"
                min="0"
                max="10"
                value={form.eva}
                onChange={(e) => setForm((f) => ({ ...f, eva: e.target.value }))}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Retenção (min)</span>
              <input
                type="number"
                min="0"
                value={form.retentionMin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, retentionMin: e.target.value }))
                }
                className={input}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className={lbl}>Padrão / observação MTC do dia</span>
            <input
              value={form.tcmNotes}
              onChange={(e) =>
                setForm((f) => ({ ...f, tcmNotes: e.target.value }))
              }
              className={input}
            />
          </label>
        </div>

        {/* PONTOS APLICADOS */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-display font-bold text-ink">Pontos aplicados</h3>
          {form.points.length === 0 && (
            <p className="mt-1 text-sm text-ink/50">Nenhum ponto adicionado.</p>
          )}
          <datalist id="acu-points">
            {COMMON_POINTS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="mt-2 space-y-2">
            {form.points.map((p, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-xl border border-ink/10 bg-sand/40 p-3 sm:grid-cols-12"
              >
                <input
                  list="acu-points"
                  value={p.point}
                  onChange={(e) => setPoint(i, "point", e.target.value)}
                  placeholder="Ponto (ex: IG4)"
                  className={`${input} sm:col-span-2`}
                />
                <select
                  value={p.side}
                  onChange={(e) => setPoint(i, "side", e.target.value)}
                  className={`${input} sm:col-span-2`}
                >
                  {SIDES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  value={p.method}
                  onChange={(e) => setPoint(i, "method", e.target.value)}
                  className={`${input} sm:col-span-3`}
                >
                  {POINT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  value={p.stimulation}
                  onChange={(e) => setPoint(i, "stimulation", e.target.value)}
                  className={`${input} sm:col-span-2`}
                >
                  {STIMULATIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <input
                  value={p.note}
                  onChange={(e) => setPoint(i, "note", e.target.value)}
                  placeholder="Obs."
                  className={`${input} sm:col-span-2`}
                />
                <div className="sm:col-span-1">
                  <button
                    onClick={() => removePoint(i)}
                    className="h-10 w-full rounded-lg border border-ink/15 text-sm font-medium text-red-500 hover:bg-red-50"
                    aria-label="Remover ponto"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addPoint}
            className="mt-3 text-sm font-semibold text-teal-600 hover:underline"
          >
            + Adicionar ponto
          </button>
        </div>

        {/* notas */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <label className="block">
            <span className={lbl}>Orientações ao paciente</span>
            <textarea
              value={form.recommendations}
              onChange={(e) =>
                setForm((f) => ({ ...f, recommendations: e.target.value }))
              }
              rows={2}
              className={area}
            />
          </label>
          <label className="mt-3 block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={area}
            />
          </label>
        </div>

        {/* próxima visita → agenda */}
        <ReturnScheduler
          establishmentId={establishmentId}
          clientId={clientId}
          title="Próxima visita"
          hint="Selecione o dia e um horário livre — o retorno é agendado direto na sua agenda para este paciente."
          onScheduled={(iso) => setForm((f) => ({ ...f, nextVisit: iso }))}
        />

        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={saving} className={primaryBtn}>
            {saving ? "Salvando..." : "Salvar sessão"}
          </button>
          <button
            onClick={cancel}
            className="h-11 rounded-xl px-4 text-sm font-medium text-ink/60 hover:underline"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ---- lista ----
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Cada sessão registra os pontos aplicados, o tempo de retenção e a
          próxima visita.
        </p>
        <button
          onClick={openNew}
          className="shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Nova sessão
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando sessões...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhuma sessão registrada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div
              key={s._id}
              className="rounded-2xl border border-ink/10 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">
                  {fmtDate(s.date)}
                  {s.eva ? (
                    <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink/60">
                      EVA {s.eva}
                    </span>
                  ) : null}
                </p>
                <div className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => openEdit(s)}
                    className="font-medium text-teal-600 hover:underline"
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => remove(s)}
                    className="font-medium text-red-500 hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/70">
                  {s.points.length} ponto{s.points.length !== 1 ? "s" : ""}
                </span>
                {s.retentionMin > 0 && (
                  <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/60">
                    {s.retentionMin} min
                  </span>
                )}
                {s.nextVisit && (
                  <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/50">
                    Retorno: {fmtDate(s.nextVisit)}
                  </span>
                )}
              </div>
              {s.points.length > 0 && (
                <p className="mt-2 text-xs text-ink/50">
                  {s.points
                    .map(
                      (p) =>
                        `${p.point}${p.side ? ` ${p.side}` : ""}${
                          p.method && p.method !== "agulha"
                            ? ` (${methodLabel(p.method)})`
                            : ""
                        }`
                    )
                    .join("  ·  ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ EVOLUÇÃO (EVA) ============
function EvolutionSection({
  items,
  loading,
}: {
  items: AcupunctureSession[];
  loading: boolean;
}) {
  const points = useMemo(
    () =>
      [...items]
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        .map((s) => ({ date: s.date, value: s.eva || 0 }))
        .filter((p) => p.value > 0),
    [items]
  );

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando...
      </div>
    );

  if (points.length < 2)
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
        Registre a dor (EVA) em pelo menos duas sessões para ver a evolução.
      </div>
    );

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h3 className="mb-3 font-display font-bold text-ink">
        Evolução da dor (EVA 0-10)
      </h3>
      <LineChart points={points} unit="EVA" />
    </div>
  );
}

function LineChart({
  points,
  unit,
}: {
  points: { date: string; value: number }[];
  unit: string;
}) {
  if (points.length === 0)
    return (
      <p className="py-8 text-center text-sm text-ink/40">Sem dados ainda.</p>
    );
  const W = 520;
  const H = 200;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const values = points.map((p) => p.value);
  let min = Math.min(...values, 0);
  let max = Math.max(...values, 10);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const spanX = points.length > 1 ? points.length - 1 : 1;
  const x = (i: number) => padL + (i / spanX) * (W - padL - padR);
  const y = (v: number) =>
    padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`
    )
    .join(" ");
  const ticks = 5;
  const gridVals = Array.from(
    { length: ticks + 1 },
    (_, i) => min + ((max - min) * i) / ticks
  );
  const fmt = (iso: string) => fmtDate(iso).slice(0, 5);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Gráfico de evolução"
      >
        {gridVals.map((gv, i) => {
          const gy = y(gv);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={gy}
                y2={gy}
                stroke="currentColor"
                className="text-ink/10"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={gy + 3}
                textAnchor="end"
                className="fill-ink/40"
                fontSize={9}
              >
                {gv.toFixed(0)}
              </text>
            </g>
          );
        })}
        <path
          d={path}
          fill="none"
          stroke="#14b8a6"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={3.5} fill="#0f766e" />
            <text
              x={x(i)}
              y={H - padB + 14}
              textAnchor="middle"
              className="fill-ink/40"
              fontSize={8.5}
            >
              {fmt(p.date)}
            </text>
          </g>
        ))}
        <text x={padL} y={11} className="fill-ink/40" fontSize={9}>
          ({unit})
        </text>
      </svg>
    </div>
  );
}
