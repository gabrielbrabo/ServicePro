import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import {
  nursingApi,
  NursingProfile,
  NursingRecord,
  NursingKind,
  RecordPayload,
  VITAL_FIELDS,
  VitalField,
  vitalFlag,
  flagColor,
  ROUTES,
  MED_KINDS,
} from "../api/nursing";
import { serviceApi, ServiceItem } from "../api/service";
import { professionalApi, Professional } from "../api/professional";
import { scheduleApi, Booking } from "../api/schedule";

// ---------- helpers ----------
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
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};
const byDateDesc = (a: NursingRecord, b: NursingRecord) =>
  new Date(b.date).getTime() - new Date(a.date).getTime();

const input =
  "h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";
const area =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500";
const lbl = "mb-1 block text-xs font-medium text-ink/60";
const primaryBtn =
  "h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60";

// ============ ENTRADA: lista de pacientes ============
export function EnfermagemManager({
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
        establishment={establishment}
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
type PatientView = "ficha" | "vitais" | "curativos" | "medicacao" | "retornos";

function PatientPanel({
  establishment,
  patient,
  onBack,
}: {
  establishment: Establishment;
  patient: EstablishmentClient;
  onBack: () => void;
}) {
  const establishmentId = establishment._id;
  const clientId = patient._id;
  const [view, setView] = useState<PatientView>("ficha");
  const [allergies, setAllergies] = useState("");

  useEffect(() => {
    nursingApi
      .getProfile(establishmentId, clientId)
      .then((p) => setAllergies(p.allergies || ""))
      .catch(() => setAllergies(""));
  }, [establishmentId, clientId]);

  const tabs: [PatientView, string][] = [
    ["ficha", "Ficha"],
    ["vitais", "Sinais vitais"],
    ["curativos", "Curativos"],
    ["medicacao", "Medicação / Vacina"],
    ["retornos", "Retornos"],
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
        {allergies && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            ⚠ Alergia: {allergies}
          </span>
        )}
      </div>

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
            onAllergies={setAllergies}
          />
        )}
        {view === "vitais" && (
          <VitalsSection establishmentId={establishmentId} clientId={clientId} />
        )}
        {view === "curativos" && (
          <DressingsSection
            establishmentId={establishmentId}
            clientId={clientId}
          />
        )}
        {view === "medicacao" && (
          <MedicationsSection
            establishmentId={establishmentId}
            clientId={clientId}
          />
        )}
        {view === "retornos" && (
          <ReturnsSection establishment={establishment} clientId={clientId} />
        )}
      </div>
    </div>
  );
}

// ============ FICHA ============
function ProfileSection({
  establishmentId,
  clientId,
  onAllergies,
}: {
  establishmentId: string;
  clientId: string;
  onAllergies?: (v: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [f, setF] = useState({
    allergies: "",
    conditions: "",
    continuousMeds: "",
    bloodType: "",
    healthNotes: "",
  });

  useEffect(() => {
    setLoading(true);
    nursingApi
      .getProfile(establishmentId, clientId)
      .then((p: NursingProfile) =>
        setF({
          allergies: p.allergies || "",
          conditions: p.conditions || "",
          continuousMeds: p.continuousMeds || "",
          bloodType: p.bloodType || "",
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
      await nursingApi.updateProfile(establishmentId, clientId, {
        allergies: f.allergies.trim(),
        conditions: f.conditions.trim(),
        continuousMeds: f.continuousMeds.trim(),
        bloodType: f.bloodType.trim(),
        healthNotes: f.healthNotes.trim(),
      });
      onAllergies?.(f.allergies.trim());
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
          <span className={lbl}>Alergias</span>
          <input
            value={f.allergies}
            onChange={(e) => set("allergies", e.target.value)}
            placeholder="Ex: dipirona, penicilina, látex — deixe claro!"
            className={input}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Comorbidades / condições</span>
            <textarea
              value={f.conditions}
              onChange={(e) => set("conditions", e.target.value)}
              rows={2}
              placeholder="Ex: hipertensão, diabetes, DPOC"
              className={area}
            />
          </label>
          <label className="block">
            <span className={lbl}>Medicações de uso contínuo</span>
            <textarea
              value={f.continuousMeds}
              onChange={(e) => set("continuousMeds", e.target.value)}
              rows={2}
              placeholder="Ex: losartana 50mg, metformina 850mg"
              className={area}
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Tipo sanguíneo</span>
            <input
              value={f.bloodType}
              onChange={(e) => set("bloodType", e.target.value)}
              placeholder="Ex: O+"
              className={input}
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className={lbl}>Observações</span>
          <textarea
            value={f.healthNotes}
            onChange={(e) => set("healthNotes", e.target.value)}
            rows={3}
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

// ============ hook genérico de registros ============
function useRecords(
  establishmentId: string,
  clientId: string,
  kind: NursingKind
) {
  const [items, setItems] = useState<NursingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    nursingApi
      .listRecords(establishmentId, clientId, kind)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId, kind]);

  const create = async (data: RecordPayload) => {
    const created = await nursingApi.createRecord(establishmentId, clientId, {
      ...data,
      kind,
    });
    setItems((l) => [created, ...l].sort(byDateDesc));
  };
  const remove = async (id: string) => {
    const prev = items;
    setItems((l) => l.filter((x) => x._id !== id));
    try {
      await nursingApi.removeRecord(establishmentId, clientId, id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover o registro.");
    }
  };
  return { items, loading, error, setError, create, remove };
}

// ============ SINAIS VITAIS ============
const emptyVitals = () => ({
  date: toDateInput(new Date()),
  systolic: "",
  diastolic: "",
  heartRate: "",
  respRate: "",
  temperature: "",
  spo2: "",
  glucose: "",
  pain: "",
  notes: "",
});

function VitalsSection({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const { items, loading, error, setError, create, remove } = useRecords(
    establishmentId,
    clientId,
    "vital"
  );
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyVitals());
  const [metricKey, setMetricKey] = useState<VitalField["key"]>("systolic");

  const set = (k: keyof ReturnType<typeof emptyVitals>, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await create({
        kind: "vital",
        date: form.date || undefined,
        systolic: Number(form.systolic) || 0,
        diastolic: Number(form.diastolic) || 0,
        heartRate: Number(form.heartRate) || 0,
        respRate: Number(form.respRate) || 0,
        temperature: Number(form.temperature) || 0,
        spo2: Number(form.spo2) || 0,
        glucose: Number(form.glucose) || 0,
        pain: Number(form.pain) || 0,
        notes: form.notes.trim(),
      });
      setForm(emptyVitals());
      setShowForm(false);
    } catch {
      setError("Não foi possível salvar os sinais vitais.");
    } finally {
      setSaving(false);
    }
  };

  const metric = VITAL_FIELDS.find((m) => m.key === metricKey)!;
  const chartMetrics = VITAL_FIELDS.filter((m) => m.chart);
  const points = useMemo(
    () =>
      [...items]
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        .map((r) => ({ date: r.date, value: (r[metricKey] as number) || 0 }))
        .filter((p) => p.value > 0),
    [items, metricKey]
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Registre os sinais vitais. Valores fora da faixa aparecem em destaque.
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            + Registrar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className={lbl}>Data</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className={input}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {VITAL_FIELDS.map((vf) => (
              <label key={vf.key} className="block">
                <span className={lbl}>
                  {vf.label} <span className="text-ink/40">({vf.unit})</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step={vf.step || "1"}
                  value={form[vf.key]}
                  onChange={(e) => set(vf.key, e.target.value)}
                  className={input}
                />
              </label>
            ))}
          </div>
          <label className="block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className={area}
            />
          </label>
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={saving} className={primaryBtn}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyVitals());
              }}
              className="h-11 rounded-xl px-4 text-sm font-medium text-ink/60 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* gráfico de evolução */}
      {points.length > 1 && (
        <div className="mb-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display font-bold text-ink">Evolução</h3>
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value as VitalField["key"])}
              className="h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
            >
              {chartMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.unit})
                </option>
              ))}
            </select>
          </div>
          <LineChart points={points} unit={metric.unit} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum registro de sinais vitais ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div
              key={r._id}
              className="rounded-xl border border-ink/10 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">
                  {fmtDate(r.date)}
                </p>
                <button
                  onClick={() => remove(r._id)}
                  className="text-sm font-medium text-red-500 hover:underline"
                >
                  Excluir
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <VitalsInline r={r} />
              </div>
              {r.notes && (
                <p className="mt-2 text-sm text-ink/60">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// mostra PA junto (sist/diast) e os demais vitais medidos, com destaque de faixa
function VitalsInline({ r }: { r: NursingRecord }) {
  const chip = (
    label: string,
    text: string,
    flag: "" | "high" | "low"
  ) => (
    <span className="flex items-center gap-1">
      <span className="text-ink/40">{label}</span>
      <span className={`font-semibold ${flagColor(flag)}`}>{text}</span>
    </span>
  );
  const out: JSX.Element[] = [];
  if (r.systolic || r.diastolic) {
    const f =
      vitalFlag("systolic", r.systolic) || vitalFlag("diastolic", r.diastolic);
    out.push(
      <span key="pa">{chip("PA", `${r.systolic || "-"}/${r.diastolic || "-"}`, f)}</span>
    );
  }
  const simple: VitalField["key"][] = [
    "heartRate",
    "respRate",
    "temperature",
    "spo2",
    "glucose",
    "pain",
  ];
  simple.forEach((k) => {
    const v = r[k] as number;
    if (!v) return;
    const vf = VITAL_FIELDS.find((x) => x.key === k)!;
    out.push(
      <span key={k}>{chip(vf.short, `${v}${vf.unit === "%" ? "%" : ""}`, vitalFlag(k, v))}</span>
    );
  });
  return out.length ? <>{out}</> : <span className="text-ink/40">—</span>;
}

// ============ CURATIVOS ============
const emptyDressing = () => ({
  date: toDateInput(new Date()),
  location: "",
  aspect: "",
  dressingType: "",
  materials: "",
  notes: "",
});

function DressingsSection({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const { items, loading, error, setError, create, remove } = useRecords(
    establishmentId,
    clientId,
    "dressing"
  );
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyDressing());
  const set = (k: keyof ReturnType<typeof emptyDressing>, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await create({
        kind: "dressing",
        date: form.date || undefined,
        location: form.location.trim(),
        aspect: form.aspect.trim(),
        dressingType: form.dressingType.trim(),
        materials: form.materials.trim(),
        notes: form.notes.trim(),
      });
      setForm(emptyDressing());
      setShowForm(false);
    } catch {
      setError("Não foi possível salvar o curativo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Registro de curativos: local, aspecto da ferida e materiais usados.
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            + Registrar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>Data</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Local da ferida</span>
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Ex: maléolo lateral direito"
                className={input}
              />
            </label>
          </div>
          <label className="block">
            <span className={lbl}>Aspecto da ferida / evolução</span>
            <textarea
              value={form.aspect}
              onChange={(e) => set("aspect", e.target.value)}
              rows={2}
              placeholder="Ex: granulação, exsudato seroso moderado, bordas..."
              className={area}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>Tipo de curativo / cobertura</span>
              <input
                value={form.dressingType}
                onChange={(e) => set("dressingType", e.target.value)}
                placeholder="Ex: hidrocoloide, alginato, gaze"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Materiais usados</span>
              <input
                value={form.materials}
                onChange={(e) => set("materials", e.target.value)}
                placeholder="Ex: SF 0,9%, ácido graxo, atadura"
                className={input}
              />
            </label>
          </div>
          <label className="block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className={area}
            />
          </label>
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={saving} className={primaryBtn}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyDressing());
              }}
              className="h-11 rounded-xl px-4 text-sm font-medium text-ink/60 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum curativo registrado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div
              key={r._id}
              className="rounded-xl border border-ink/10 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">
                  {fmtDate(r.date)}
                  {r.location ? (
                    <span className="ml-2 font-normal text-ink/60">
                      {r.location}
                    </span>
                  ) : null}
                </p>
                <button
                  onClick={() => remove(r._id)}
                  className="text-sm font-medium text-red-500 hover:underline"
                >
                  Excluir
                </button>
              </div>
              {r.aspect && (
                <p className="mt-1 text-sm text-ink/70">{r.aspect}</p>
              )}
              <p className="mt-1 text-xs text-ink/50">
                {[
                  r.dressingType ? `Cobertura: ${r.dressingType}` : "",
                  r.materials ? `Materiais: ${r.materials}` : "",
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
              {r.notes && (
                <p className="mt-1 text-sm text-ink/60">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ MEDICAÇÃO / VACINA ============
const emptyMed = () => ({
  date: toDateInput(new Date()),
  medKind: "medicacao",
  name: "",
  dose: "",
  route: "VO",
  site: "",
  lot: "",
  expiry: "",
  notes: "",
});

function MedicationsSection({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const { items, loading, error, setError, create, remove } = useRecords(
    establishmentId,
    clientId,
    "medication"
  );
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyMed());
  const set = (k: keyof ReturnType<typeof emptyMed>, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const isVaccine = form.medKind === "vacina";

  const submit = async () => {
    setSaving(true);
    try {
      await create({
        kind: "medication",
        date: form.date || undefined,
        medKind: form.medKind,
        name: form.name.trim(),
        dose: form.dose.trim(),
        route: form.route.trim(),
        site: form.site.trim(),
        lot: form.lot.trim(),
        expiry: form.expiry || null,
        notes: form.notes.trim(),
      });
      setForm(emptyMed());
      setShowForm(false);
    } catch {
      setError("Não foi possível salvar a aplicação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Aplicação de medicação e vacina: nome, dose, via, local e lote.
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            + Registrar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className={lbl}>Data</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Tipo</span>
              <select
                value={form.medKind}
                onChange={(e) => set("medKind", e.target.value)}
                className={input}
              >
                {MED_KINDS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={lbl}>
                {isVaccine ? "Vacina" : "Medicamento"}
              </span>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={isVaccine ? "Ex: Influenza" : "Ex: Dipirona"}
                className={input}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className={lbl}>Dose</span>
              <input
                value={form.dose}
                onChange={(e) => set("dose", e.target.value)}
                placeholder="Ex: 500 mg / 0,5 mL"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Via</span>
              <select
                value={form.route}
                onChange={(e) => set("route", e.target.value)}
                className={input}
              >
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={lbl}>Local de aplicação</span>
              <input
                value={form.site}
                onChange={(e) => set("site", e.target.value)}
                placeholder="Ex: deltoide D"
                className={input}
              />
            </label>
            {isVaccine && (
              <label className="block">
                <span className={lbl}>Lote</span>
                <input
                  value={form.lot}
                  onChange={(e) => set("lot", e.target.value)}
                  className={input}
                />
              </label>
            )}
          </div>
          {isVaccine && (
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block">
                <span className={lbl}>Validade</span>
                <input
                  type="date"
                  value={form.expiry}
                  onChange={(e) => set("expiry", e.target.value)}
                  className={input}
                />
              </label>
            </div>
          )}
          <label className="block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className={area}
            />
          </label>
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={saving} className={primaryBtn}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyMed());
              }}
              className="h-11 rounded-xl px-4 text-sm font-medium text-ink/60 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhuma aplicação registrada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div
              key={r._id}
              className="rounded-xl border border-ink/10 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">
                  {r.name || "—"}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.medKind === "vacina"
                        ? "bg-violet-100 text-violet-700"
                        : "bg-teal-500/10 text-teal-600"
                    }`}
                  >
                    {r.medKind === "vacina" ? "Vacina" : "Medicação"}
                  </span>
                </p>
                <button
                  onClick={() => remove(r._id)}
                  className="text-sm font-medium text-red-500 hover:underline"
                >
                  Excluir
                </button>
              </div>
              <p className="mt-1 text-xs text-ink/50">
                {[
                  fmtDate(r.date),
                  r.dose,
                  r.route,
                  r.site,
                  r.lot ? `Lote ${r.lot}` : "",
                  r.expiry ? `Val. ${fmtDate(r.expiry)}` : "",
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
              {r.notes && (
                <p className="mt-1 text-sm text-ink/60">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ RETORNOS (integra com a agenda) ============
function ReturnsSection({
  establishment,
  clientId,
}: {
  establishment: Establishment;
  clientId: string;
}) {
  const establishmentId = establishment._id;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);

  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState(""); // ISO
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);

  // carrega agendamentos, serviços e profissionais
  const loadBookings = () => {
    setLoading(true);
    scheduleApi
      .listBookings("provider", establishmentId)
      .then((list) =>
        setBookings(
          list.filter(
            (b) => (b.client?._id || "") === clientId
          )
        )
      )
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    loadBookings();
    serviceApi
      .listByEstablishment(establishmentId)
      .then((list) => {
        const actives = list.filter((s) => s.active !== false);
        setServices(actives);
        if (actives[0]) setServiceId(actives[0]._id);
      })
      .catch(() => setServices([]));
    professionalApi
      .list(establishmentId)
      .then((list) => {
        setPros(list);
        if (list[0]) setProfessionalId(list[0]._id);
      })
      .catch(() => setPros([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, clientId]);

  // busca horários livres quando serviço + data (+ profissional) mudam
  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSlot("");
    scheduleApi
      .freeSlots(serviceId, date, professionalId || undefined, null, true)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [serviceId, date, professionalId]);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            b.status !== "cancelado" &&
            new Date(b.endsAt || b.scheduledAt).getTime() >= now
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime()
        ),
    [bookings, now]
  );

  const scheduleReturn = async () => {
    if (!serviceId || !slot) {
      setError("Escolha o serviço, a data e um horário livre.");
      return;
    }
    setBooking(true);
    setError(null);
    setOk(null);
    try {
      await scheduleApi.createBooking({
        serviceId,
        scheduledAt: slot,
        clientId,
        professionalId: professionalId || undefined,
        notes: notes.trim() || undefined,
      });
      setOk("Retorno agendado na agenda!");
      setNotes("");
      setSlot("");
      loadBookings();
      // recarrega os horários (o que foi usado sai da lista)
      if (serviceId && date) {
        scheduleApi
          .freeSlots(serviceId, date, professionalId || undefined, null, true)
          .then((r) => setSlots(r.slots))
          .catch(() => {});
      }
      setTimeout(() => setOk(null), 3000);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      setError(
        status === 409
          ? "Esse horário não está mais disponível. Escolha outro."
          : "Não foi possível agendar o retorno."
      );
    } finally {
      setBooking(false);
    }
  };

  const cancel = async (b: Booking) => {
    const prev = bookings;
    setBookings((list) =>
      list.map((x) =>
        x._id === b._id ? { ...x, status: "cancelado" } : x
      )
    );
    try {
      await scheduleApi.updateStatus(b._id, "cancelado");
    } catch {
      setBookings(prev);
      setError("Não foi possível cancelar.");
    }
  };

  const statusLabel: Record<string, string> = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    concluido: "Concluído",
    reservado: "Reservado",
  };

  return (
    <div className="space-y-5">
      {/* agendar retorno */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Agendar retorno</h3>
        <p className="mt-1 text-xs text-ink/50">
          Escolha o serviço e a data — só aparecem horários livres na agenda. O
          retorno é agendado direto na sua agenda.
        </p>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-3 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
            {ok}
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Serviço</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={input}
            >
              {services.length === 0 && (
                <option value="">Nenhum serviço cadastrado</option>
              )}
              {services.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          {pros.length > 0 && (
            <label className="block">
              <span className={lbl}>Profissional</span>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className={input}
              >
                {pros.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className={lbl}>Data</span>
            <input
              type="date"
              value={date}
              min={toDateInput(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Horário livre</span>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              disabled={!serviceId || !date || slotsLoading}
              className={input}
            >
              {!date ? (
                <option value="">Escolha a data</option>
              ) : slotsLoading ? (
                <option value="">Carregando horários...</option>
              ) : slots.length === 0 ? (
                <option value="">Sem horários livres nesta data</option>
              ) : (
                <>
                  <option value="">Selecione...</option>
                  {slots.map((iso) => (
                    <option key={iso} value={iso}>
                      {hhmm(iso)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className={lbl}>Observação (opcional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: retorno para troca de curativo"
            className={input}
          />
        </label>
        <div className="mt-3">
          <button
            onClick={scheduleReturn}
            disabled={booking || !slot}
            className={primaryBtn}
          >
            {booking ? "Agendando..." : "Agendar retorno"}
          </button>
        </div>
      </div>

      {/* próximos retornos */}
      <div>
        <h3 className="mb-2 font-display font-bold text-ink">
          Próximos retornos
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando...
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/50">
            Nenhum retorno agendado.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div
                key={b._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white p-4"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {fmtDateTime(b.scheduledAt)}
                  </p>
                  <p className="text-xs text-ink/50">
                    {b.service?.title}
                    {b.professionalName ? ` · ${b.professionalName}` : ""} ·{" "}
                    <span className="font-medium text-ink/60">
                      {statusLabel[b.status] || b.status}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => cancel(b)}
                  className="text-sm font-medium text-red-500 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ gráfico de linha (SVG, sem dependências) ============
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
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min = min - 1;
    max = max + 1;
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
  const ticks = 4;
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
                {gv.toFixed(gv >= 100 ? 0 : 1)}
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
          {unit ? `(${unit})` : ""}
        </text>
      </svg>
    </div>
  );
}
