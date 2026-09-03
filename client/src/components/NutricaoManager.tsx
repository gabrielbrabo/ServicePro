import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import {
  nutritionApi,
  NutritionAssessment,
  NutritionProfile,
  NutritionPlan,
  Meal,
  BodyMeasurements,
  AssessmentPayload,
  MEASURE_FIELDS,
  ACTIVITY_LEVELS,
  emptyMeasurements,
  bmi,
  bmiClass,
  whr,
  fatMass,
  leanMass,
} from "../api/nutrition";
import { ImageUpload } from "./ImageUpload";
import { deleteUploadByUrl } from "../api/upload";
import { ReturnScheduler } from "./ReturnScheduler";

// data local YYYY-MM-DD para <input type="date">
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

// ============ ENTRADA: lista de pacientes ============
export function NutricaoManager({
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
type PatientView = "perfil" | "antropometria" | "evolucao" | "plano" | "retornos";

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
  const [view, setView] = useState<PatientView>("perfil");

  // antropometrias compartilhadas entre "antropometria" e "evolucao"
  const [assessments, setAssessments] = useState<NutritionAssessment[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  // metas do perfil (para relacionar com o plano)
  const [profile, setProfile] = useState<NutritionProfile | null>(null);

  useEffect(() => {
    setLoadingA(true);
    nutritionApi
      .listAssessments(establishmentId, clientId)
      .then(setAssessments)
      .catch(() => setAssessments([]))
      .finally(() => setLoadingA(false));
    nutritionApi
      .getProfile(establishmentId, clientId)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [establishmentId, clientId]);

  const latest = assessments[0]; // já vem ordenado desc
  const latestBmi = latest ? bmi(latest.weight, latest.height) : 0;
  const cls = bmiClass(latestBmi);

  const tabs: [PatientView, string][] = [
    ["perfil", "Perfil e metas"],
    ["antropometria", "Antropometria"],
    ["evolucao", "Evolução"],
    ["plano", "Plano alimentar"],
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

      {/* resumo do paciente */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">
          {patient.name}
        </h2>
        {latest && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {latest.weight > 0 && (
              <span className="rounded-full bg-ink/5 px-3 py-1 font-medium text-ink/70">
                {latest.weight} kg
              </span>
            )}
            {latestBmi > 0 && (
              <span
                className={`rounded-full bg-ink/5 px-3 py-1 font-semibold ${cls.color}`}
              >
                IMC {latestBmi.toFixed(1)} · {cls.label}
              </span>
            )}
            <span className="rounded-full bg-ink/5 px-3 py-1 text-ink/50">
              Última: {fmtDate(latest.date)}
            </span>
          </div>
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
        {view === "perfil" && (
          <ProfileSection
            establishmentId={establishmentId}
            clientId={clientId}
            onSaved={setProfile}
          />
        )}
        {view === "antropometria" && (
          <AnthropometrySection
            establishmentId={establishmentId}
            clientId={clientId}
            items={assessments}
            loading={loadingA}
            setItems={setAssessments}
          />
        )}
        {view === "evolucao" && (
          <EvolutionSection items={assessments} loading={loadingA} />
        )}
        {view === "plano" && (
          <PlanSection
            establishmentId={establishmentId}
            clientId={clientId}
            profile={profile}
          />
        )}
        {view === "retornos" && (
          <ReturnScheduler
            establishmentId={establishmentId}
            clientId={clientId}
            title="Agendar retorno"
          />
        )}
      </div>
    </div>
  );
}

// ============ PERFIL E METAS ============
function ProfileSection({
  establishmentId,
  clientId,
  onSaved,
}: {
  establishmentId: string;
  clientId: string;
  onSaved?: (p: NutritionProfile) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [goal, setGoal] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetCalories, setTargetCalories] = useState("");
  const [targetProtein, setTargetProtein] = useState("");
  const [targetCarbs, setTargetCarbs] = useState("");
  const [targetFat, setTargetFat] = useState("");
  const [targetWater, setTargetWater] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [preferences, setPreferences] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [photos, setPhotos] = useState<
    { url: string; date: string; note: string }[]
  >([]);

  useEffect(() => {
    setLoading(true);
    nutritionApi
      .getProfile(establishmentId, clientId)
      .then((p: NutritionProfile) => {
        const num = (n: number) => (n ? String(n) : "");
        setGoal(p.goal || "");
        setActivityLevel(p.activityLevel || "");
        setTargetWeight(num(p.targetWeight));
        setTargetCalories(num(p.targetCalories));
        setTargetProtein(num(p.targetProtein));
        setTargetCarbs(num(p.targetCarbs));
        setTargetFat(num(p.targetFat));
        setTargetWater(num(p.targetWater));
        setRestrictions(p.restrictions || "");
        setPreferences(p.preferences || "");
        setHealthNotes(p.healthNotes || "");
        setPhotos(
          (p.photos || []).map((ph) => ({
            url: ph.url,
            date: ph.date
              ? toDateInput(new Date(ph.date))
              : toDateInput(new Date()),
            note: ph.note || "",
          }))
        );
      })
      .catch(() => setError("Não foi possível carregar a ficha."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const addPhoto = (url: string) => {
    if (url)
      setPhotos((list) => [
        ...list,
        { url, date: toDateInput(new Date()), note: "" },
      ]);
  };
  const removePhoto = (url: string) => {
    setPhotos((list) => list.filter((p) => p.url !== url));
    void deleteUploadByUrl(url);
  };
  const setPhotoField = (url: string, k: "date" | "note", v: string) =>
    setPhotos((list) =>
      list.map((p) => (p.url === url ? { ...p, [k]: v } : p))
    );

  // kcal a partir dos macros (4/4/9), para conferência com a meta calórica
  const macroKcal =
    (Number(targetProtein) || 0) * 4 +
    (Number(targetCarbs) || 0) * 4 +
    (Number(targetFat) || 0) * 9;
  const calDiff =
    Number(targetCalories) > 0 && macroKcal > 0
      ? macroKcal - Number(targetCalories)
      : 0;

  const save = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const saved = await nutritionApi.updateProfile(establishmentId, clientId, {
        goal: goal.trim(),
        activityLevel,
        targetWeight: Number(targetWeight) || 0,
        targetCalories: Number(targetCalories) || 0,
        targetProtein: Number(targetProtein) || 0,
        targetCarbs: Number(targetCarbs) || 0,
        targetFat: Number(targetFat) || 0,
        targetWater: Number(targetWater) || 0,
        restrictions: restrictions.trim(),
        preferences: preferences.trim(),
        healthNotes: healthNotes.trim(),
        photos: photos.map((p) => ({
          url: p.url,
          date: p.date || undefined,
          note: p.note.trim(),
        })),
      });
      onSaved?.(saved);
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Objetivo</span>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="Ex: emagrecimento, ganho de massa, reeducação alimentar, controle glicêmico..."
              className={area}
            />
          </label>
          <label className="block">
            <span className={lbl}>Nível de atividade física</span>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className={input}
            >
              <option value="">Não informado</option>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* METAS */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Metas diárias</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="block">
            <span className={lbl}>Peso-meta (kg)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Calorias (kcal)</span>
            <input
              type="number"
              min="0"
              value={targetCalories}
              onChange={(e) => setTargetCalories(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Proteína (g)</span>
            <input
              type="number"
              min="0"
              value={targetProtein}
              onChange={(e) => setTargetProtein(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Carboidrato (g)</span>
            <input
              type="number"
              min="0"
              value={targetCarbs}
              onChange={(e) => setTargetCarbs(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Gordura (g)</span>
            <input
              type="number"
              min="0"
              value={targetFat}
              onChange={(e) => setTargetFat(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Água (ml)</span>
            <input
              type="number"
              min="0"
              step="50"
              value={targetWater}
              onChange={(e) => setTargetWater(e.target.value)}
              className={input}
            />
          </label>
        </div>
        {macroKcal > 0 && (
          <p className="mt-3 text-xs text-ink/50">
            Macros somam{" "}
            <span className="font-semibold text-ink/70">
              {Math.round(macroKcal)} kcal
            </span>
            {Number(targetCalories) > 0 && (
              <>
                {" "}
                ·{" "}
                <span
                  className={
                    Math.abs(calDiff) <= 50
                      ? "text-teal-600"
                      : "text-amber-600"
                  }
                >
                  {calDiff === 0
                    ? "bate com a meta calórica"
                    : `${calDiff > 0 ? "+" : ""}${Math.round(
                        calDiff
                      )} kcal vs. meta`}
                </span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <label className="block">
          <span className={lbl}>Restrições / alergias / intolerâncias</span>
          <textarea
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            rows={2}
            placeholder="Ex: intolerância à lactose, alergia a frutos do mar, sem glúten"
            className={area}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Preferências / aversões alimentares</span>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            rows={2}
            placeholder="Ex: não gosta de peixe, prefere frango, adora frutas"
            className={area}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Histórico / medicamentos / observações</span>
          <textarea
            value={healthNotes}
            onChange={(e) => setHealthNotes(e.target.value)}
            rows={3}
            className={area}
          />
        </label>
      </div>

      {/* Fotos de progresso */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Fotos de progresso</h3>
        {photos.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p) => (
              <div
                key={p.url}
                className="rounded-xl border border-ink/10 bg-sand/40 p-2"
              >
                <div className="relative">
                  <img
                    src={p.url}
                    alt=""
                    className="h-40 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.url)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                    aria-label="Remover foto"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="date"
                  value={p.date}
                  onChange={(e) => setPhotoField(p.url, "date", e.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-xs outline-none focus:border-teal-500"
                />
                <input
                  value={p.note}
                  onChange={(e) => setPhotoField(p.url, "note", e.target.value)}
                  placeholder="Legenda (ex: frente, lateral)"
                  className="mt-2 h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-xs outline-none focus:border-teal-500"
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <ImageUpload
            value=""
            onChange={addPhoto}
            folder="nutricao"
            label=""
            hint="Adicione uma foto por vez."
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar ficha"}
        </button>
        {ok && <span className="text-sm font-medium text-teal-600">Salvo!</span>}
      </div>
    </div>
  );
}

// ============ ANTROPOMETRIA ============
const emptyAssessmentForm = () => ({
  date: toDateInput(new Date()),
  weight: "",
  height: "",
  bodyFat: "",
  measurements: emptyMeasurements(),
  notes: "",
});
type AssessmentForm = ReturnType<typeof emptyAssessmentForm>;

function AnthropometrySection({
  establishmentId,
  clientId,
  items,
  loading,
  setItems,
}: {
  establishmentId: string;
  clientId: string;
  items: NutritionAssessment[];
  loading: boolean;
  setItems: React.Dispatch<React.SetStateAction<NutritionAssessment[]>>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssessmentForm>(emptyAssessmentForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (k: keyof AssessmentForm, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v as never }));
  const setMeasure = (k: keyof BodyMeasurements, v: string) =>
    setForm((f) => ({
      ...f,
      measurements: { ...f.measurements, [k]: Number(v) || 0 },
    }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyAssessmentForm());
    setShowForm(true);
    setError(null);
  };
  const openEdit = (a: NutritionAssessment) => {
    setEditingId(a._id);
    setForm({
      date: toDateInput(new Date(a.date)),
      weight: a.weight ? String(a.weight) : "",
      height: a.height ? String(a.height) : "",
      bodyFat: a.bodyFat ? String(a.bodyFat) : "",
      measurements: { ...emptyMeasurements(), ...a.measurements },
      notes: a.notes || "",
    });
    setShowForm(true);
    setError(null);
  };
  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyAssessmentForm());
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: AssessmentPayload = {
      date: form.date || undefined,
      weight: Number(form.weight) || 0,
      height: Number(form.height) || 0,
      bodyFat: Number(form.bodyFat) || 0,
      measurements: form.measurements,
      notes: form.notes.trim(),
    };
    try {
      if (editingId) {
        const updated = await nutritionApi.updateAssessment(
          establishmentId,
          clientId,
          editingId,
          payload
        );
        setItems((list) =>
          list
            .map((x) => (x._id === editingId ? updated : x))
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );
      } else {
        const created = await nutritionApi.createAssessment(
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
      setError("Não foi possível salvar a avaliação.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: NutritionAssessment) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== a._id));
    try {
      await nutritionApi.removeAssessment(establishmentId, clientId, a._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover a avaliação.");
    }
  };

  // valores derivados ao vivo no formulário
  const fW = Number(form.weight) || 0;
  const fH = Number(form.height) || 0;
  const fBf = Number(form.bodyFat) || 0;
  const fWaist = form.measurements.waist || 0;
  const fHip = form.measurements.hip || 0;
  const fBmi = bmi(fW, fH);
  const fBmiCls = bmiClass(fBmi);
  const fWhr = whr(fWaist, fHip);
  const fFat = fatMass(fW, fBf);
  const fLean = leanMass(fW, fBf);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Peso, altura, composição corporal e circunferências — registre
          periodicamente para acompanhar a evolução.
        </p>
        {!showForm && (
          <button
            onClick={openNew}
            className="shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            + Nova avaliação
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 space-y-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h4 className="font-display font-bold text-ink">
            {editingId ? "Editar avaliação" : "Nova avaliação"}
          </h4>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className={lbl}>Data</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Peso (kg)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.weight}
                onChange={(e) => setField("weight", e.target.value)}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Altura (cm)</span>
              <input
                type="number"
                min="0"
                value={form.height}
                onChange={(e) => setField("height", e.target.value)}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>% Gordura</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.bodyFat}
                onChange={(e) => setField("bodyFat", e.target.value)}
                className={input}
              />
            </label>
          </div>

          {/* indicadores calculados ao vivo */}
          {(fBmi > 0 || fWhr > 0 || fFat > 0) && (
            <div className="grid gap-2 sm:grid-cols-4">
              {fBmi > 0 && (
                <div className="rounded-xl bg-sand/40 px-3 py-2">
                  <span className={lbl}>IMC</span>
                  <p className={`text-sm font-semibold ${fBmiCls.color}`}>
                    {fBmi.toFixed(1)}{" "}
                    <span className="font-normal text-ink/50">
                      · {fBmiCls.label}
                    </span>
                  </p>
                </div>
              )}
              {fWhr > 0 && (
                <div className="rounded-xl bg-sand/40 px-3 py-2">
                  <span className={lbl}>RCQ (cintura/quadril)</span>
                  <p className="text-sm font-semibold text-ink/80">
                    {fWhr.toFixed(2)}
                  </p>
                </div>
              )}
              {fFat > 0 && (
                <div className="rounded-xl bg-sand/40 px-3 py-2">
                  <span className={lbl}>Massa gorda</span>
                  <p className="text-sm font-semibold text-ink/80">
                    {fFat.toFixed(1)} kg
                  </p>
                </div>
              )}
              {fLean > 0 && (
                <div className="rounded-xl bg-sand/40 px-3 py-2">
                  <span className={lbl}>Massa magra</span>
                  <p className="text-sm font-semibold text-ink/80">
                    {fLean.toFixed(1)} kg
                  </p>
                </div>
              )}
            </div>
          )}

          {/* medidas (cm) */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <span className="mb-2 block text-sm font-medium text-ink/70">
              Circunferências (cm)
            </span>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {MEASURE_FIELDS.map((m) => (
                <label key={m.key} className="block">
                  <span className={lbl}>{m.label}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.measurements[m.key] || ""}
                    onChange={(e) => setMeasure(m.key, e.target.value)}
                    className={input}
                  />
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
              className={area}
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={saving}
              className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar avaliação"}
            </button>
            <button
              onClick={cancel}
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
          Carregando avaliações...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhuma avaliação registrada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const b = bmi(a.weight, a.height);
            const c = bmiClass(b);
            const measured = MEASURE_FIELDS.filter(
              (m) => (a.measurements?.[m.key] || 0) > 0
            );
            return (
              <div
                key={a._id}
                className="rounded-xl border border-ink/10 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{fmtDate(a.date)}</p>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      onClick={() => openEdit(a)}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="font-medium text-red-500 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {a.weight > 0 && (
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/70">
                      Peso {a.weight} kg
                    </span>
                  )}
                  {a.height > 0 && (
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/70">
                      Altura {a.height} cm
                    </span>
                  )}
                  {b > 0 && (
                    <span
                      className={`rounded-full bg-ink/5 px-2.5 py-1 font-semibold ${c.color}`}
                    >
                      IMC {b.toFixed(1)} · {c.label}
                    </span>
                  )}
                  {a.bodyFat > 0 && (
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/70">
                      Gordura {a.bodyFat}%
                    </span>
                  )}
                </div>
                {measured.length > 0 && (
                  <p className="mt-2 text-xs text-ink/50">
                    {measured
                      .map((m) => `${m.label} ${a.measurements[m.key]}`)
                      .join("  ·  ")}
                  </p>
                )}
                {a.notes && (
                  <p className="mt-2 text-sm text-ink/70">{a.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ EVOLUÇÃO (gráfico + comparação) ============
type MetricKey =
  | "weight"
  | "bodyFat"
  | "imc"
  | "whr"
  | "fatMass"
  | "leanMass"
  | keyof BodyMeasurements;
interface Metric {
  key: MetricKey;
  label: string;
  unit: string;
  get: (a: NutritionAssessment) => number;
}
const METRICS: Metric[] = [
  { key: "weight", label: "Peso", unit: "kg", get: (a) => a.weight },
  { key: "bodyFat", label: "% Gordura", unit: "%", get: (a) => a.bodyFat },
  { key: "imc", label: "IMC", unit: "", get: (a) => bmi(a.weight, a.height) },
  {
    key: "whr",
    label: "RCQ (cintura/quadril)",
    unit: "",
    get: (a) => whr(a.measurements?.waist || 0, a.measurements?.hip || 0),
  },
  {
    key: "fatMass",
    label: "Massa gorda",
    unit: "kg",
    get: (a) => fatMass(a.weight, a.bodyFat),
  },
  {
    key: "leanMass",
    label: "Massa magra",
    unit: "kg",
    get: (a) => leanMass(a.weight, a.bodyFat),
  },
  ...MEASURE_FIELDS.map((m) => ({
    key: m.key as MetricKey,
    label: m.label,
    unit: "cm",
    get: (a: NutritionAssessment) => a.measurements?.[m.key] || 0,
  })),
];

function EvolutionSection({
  items,
  loading,
}: {
  items: NutritionAssessment[];
  loading: boolean;
}) {
  const [metricKey, setMetricKey] = useState<MetricKey>("weight");
  const metric = METRICS.find((m) => m.key === metricKey) || METRICS[0];

  const chrono = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [items]
  );

  const points = useMemo(
    () =>
      chrono
        .map((a) => ({ date: a.date, value: metric.get(a) }))
        .filter((p) => p.value > 0),
    [chrono, metric]
  );

  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");
  useEffect(() => {
    if (chrono.length >= 2) {
      setAId(chrono[0]._id);
      setBId(chrono[chrono.length - 1]._id);
    } else if (chrono.length === 1) {
      setAId(chrono[0]._id);
      setBId(chrono[0]._id);
    }
  }, [chrono]);

  const aAssess = items.find((x) => x._id === aId) || null;
  const bAssess = items.find((x) => x._id === bId) || null;

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando evolução...
      </div>
    );

  if (items.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
        Registre avaliações na aba "Antropometria" para ver a evolução.
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-bold text-ink">
            Gráfico de evolução
          </h3>
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value as MetricKey)}
            className="h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
                {m.unit ? ` (${m.unit})` : ""}
              </option>
            ))}
          </select>
        </div>
        <LineChart points={points} unit={metric.unit} />
      </div>

      {chrono.length >= 2 && aAssess && bAssess && (
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="mb-3 font-display font-bold text-ink">
            Comparar avaliações
          </h3>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>Avaliação A</span>
              <select
                value={aId}
                onChange={(e) => setAId(e.target.value)}
                className={input}
              >
                {chrono.map((a) => (
                  <option key={a._id} value={a._id}>
                    {fmtDate(a.date)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={lbl}>Avaliação B</span>
              <select
                value={bId}
                onChange={(e) => setBId(e.target.value)}
                className={input}
              >
                {chrono.map((a) => (
                  <option key={a._id} value={a._id}>
                    {fmtDate(a.date)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <CompareTable a={aAssess} b={bAssess} />
        </div>
      )}
    </div>
  );
}

// gráfico de linha simples em SVG (sem dependências)
function LineChart({
  points,
  unit,
}: {
  points: { date: string; value: number }[];
  unit: string;
}) {
  if (points.length === 0)
    return (
      <p className="py-8 text-center text-sm text-ink/40">
        Sem dados para essa métrica ainda.
      </p>
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
              {fmtDate(p.date).slice(0, 5)}
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

function CompareTable({
  a,
  b,
}: {
  a: NutritionAssessment;
  b: NutritionAssessment;
}) {
  const rows = METRICS.map((m) => {
    const va = m.get(a);
    const vb = m.get(b);
    return { m, va, vb, delta: vb - va };
  }).filter((r) => r.va > 0 || r.vb > 0);

  const dp = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
            <th className="py-2 pr-3 font-medium">Métrica</th>
            <th className="py-2 px-3 text-right font-medium">
              {fmtDate(a.date)}
            </th>
            <th className="py-2 px-3 text-right font-medium">
              {fmtDate(b.date)}
            </th>
            <th className="py-2 pl-3 text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, va, vb, delta }) => (
            <tr key={m.key} className="border-b border-ink/5">
              <td className="py-2 pr-3 text-ink/80">
                {m.label}
                {m.unit ? <span className="text-ink/40"> ({m.unit})</span> : null}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-ink/70">
                {va > 0 ? dp(va) : "—"}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-ink/70">
                {vb > 0 ? dp(vb) : "—"}
              </td>
              <td
                className={`py-2 pl-3 text-right font-semibold tabular-nums ${
                  va > 0 && vb > 0
                    ? delta < 0
                      ? "text-emerald-600"
                      : delta > 0
                      ? "text-amber-600"
                      : "text-ink/40"
                    : "text-ink/30"
                }`}
              >
                {va > 0 && vb > 0 ? `${delta > 0 ? "+" : ""}${dp(delta)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ PLANO ALIMENTAR ============
const emptyItem = () => ({
  food: "",
  amount: "",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  notes: "",
});
const emptyMeal = (label = ""): Meal => ({
  label,
  time: "",
  items: [emptyItem()],
  notes: "",
});
const DEFAULT_MEALS = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
];
const emptyPlanForm = () => ({
  name: "",
  goal: "",
  active: true,
  notes: "",
  meals: [emptyMeal("Café da manhã"), emptyMeal("Almoço"), emptyMeal("Jantar")],
});
type PlanForm = ReturnType<typeof emptyPlanForm>;

// soma de macros/kcal de uma refeição
function mealTotals(meal: Meal) {
  return meal.items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + (Number(it.calories) || 0),
      p: acc.p + (Number(it.protein) || 0),
      c: acc.c + (Number(it.carbs) || 0),
      f: acc.f + (Number(it.fat) || 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}
function planTotals(meals: Meal[]) {
  return meals.reduce(
    (acc, m) => {
      const t = mealTotals(m);
      return {
        kcal: acc.kcal + t.kcal,
        p: acc.p + t.p,
        c: acc.c + t.c,
        f: acc.f + t.f,
      };
    },
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

function PlanSection({
  establishmentId,
  clientId,
  profile,
}: {
  establishmentId: string;
  clientId: string;
  profile: NutritionProfile | null;
}) {
  const [items, setItems] = useState<NutritionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyPlanForm());
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    nutritionApi
      .listPlans(establishmentId, clientId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const openNew = () => {
    setForm(emptyPlanForm());
    setEditing("new");
    setError(null);
  };
  const openEdit = (p: NutritionPlan) => {
    setForm({
      name: p.name || "",
      goal: p.goal || "",
      active: p.active,
      notes: p.notes || "",
      meals:
        p.meals && p.meals.length
          ? p.meals.map((m) => ({
              label: m.label,
              time: m.time,
              notes: m.notes,
              items:
                m.items && m.items.length
                  ? m.items.map((it) => ({ ...emptyItem(), ...it }))
                  : [emptyItem()],
            }))
          : [emptyMeal()],
    });
    setEditing(p._id);
    setError(null);
  };
  const cancel = () => {
    setEditing(null);
    setForm(emptyPlanForm());
  };

  // helpers de edição do formulário
  const setMealField = (mi: number, k: keyof Meal, v: string) =>
    setForm((f) => {
      const meals = [...f.meals];
      meals[mi] = { ...meals[mi], [k]: v };
      return { ...f, meals };
    });
  const setItemField = (
    mi: number,
    ii: number,
    k: keyof ReturnType<typeof emptyItem>,
    v: string
  ) =>
    setForm((f) => {
      const meals = [...f.meals];
      const items = [...meals[mi].items];
      const numeric = ["calories", "protein", "carbs", "fat"].includes(k);
      items[ii] = { ...items[ii], [k]: numeric ? Number(v) || 0 : v };
      meals[mi] = { ...meals[mi], items };
      return { ...f, meals };
    });
  const addItem = (mi: number) =>
    setForm((f) => {
      const meals = [...f.meals];
      meals[mi] = { ...meals[mi], items: [...meals[mi].items, emptyItem()] };
      return { ...f, meals };
    });
  const removeItem = (mi: number, ii: number) =>
    setForm((f) => {
      const meals = [...f.meals];
      const items = meals[mi].items.filter((_, idx) => idx !== ii);
      meals[mi] = { ...meals[mi], items: items.length ? items : [emptyItem()] };
      return { ...f, meals };
    });
  const addMeal = () =>
    setForm((f) => {
      const next = DEFAULT_MEALS[f.meals.length] || "";
      return { ...f, meals: [...f.meals, emptyMeal(next)] };
    });
  const removeMeal = (mi: number) =>
    setForm((f) => ({
      ...f,
      meals: f.meals.filter((_, idx) => idx !== mi),
    }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim() || "Plano alimentar",
      goal: form.goal.trim(),
      active: form.active,
      notes: form.notes.trim(),
      meals: form.meals,
    };
    try {
      if (editing && editing !== "new") {
        const updated = await nutritionApi.updatePlan(
          establishmentId,
          clientId,
          editing,
          payload
        );
        setItems((list) => {
          const next = list.map((x) => (x._id === editing ? updated : x));
          // se virou ativo, desativa os outros localmente
          return updated.active
            ? next.map((x) =>
                x._id === updated._id ? x : { ...x, active: false }
              )
            : next;
        });
      } else {
        const created = await nutritionApi.createPlan(
          establishmentId,
          clientId,
          payload
        );
        setItems((list) => {
          const base = created.active
            ? list.map((x) => ({ ...x, active: false }))
            : list;
          return [created, ...base];
        });
      }
      cancel();
    } catch {
      setError("Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: NutritionPlan) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== p._id));
    try {
      await nutritionApi.removePlan(establishmentId, clientId, p._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover o plano.");
    }
  };

  const downloadPdf = async (p: NutritionPlan) => {
    setPdfBusy(p._id);
    try {
      const blob = await nutritionApi.planPdf(establishmentId, clientId, p._id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("Não foi possível gerar o PDF.");
    } finally {
      setPdfBusy(null);
    }
  };

  // ---- formulário ----
  if (editing) {
    const totals = planTotals(form.meals);
    const target = profile?.targetCalories || 0;
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>Nome do plano</span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ex: Plano — Fase 1"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Objetivo do plano</span>
              <input
                value={form.goal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, goal: e.target.value }))
                }
                placeholder="Ex: déficit calórico leve"
                className={input}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
              className="h-4 w-4 accent-teal-500"
            />
            Plano atual do paciente
          </label>
        </div>

        {/* refeições */}
        {form.meals.map((meal, mi) => {
          const t = mealTotals(meal);
          return (
            <div
              key={mi}
              className="rounded-2xl border border-ink/10 bg-white p-5"
            >
              <div className="flex flex-wrap items-end gap-3">
                <label className="block flex-1">
                  <span className={lbl}>Refeição</span>
                  <input
                    value={meal.label}
                    onChange={(e) => setMealField(mi, "label", e.target.value)}
                    placeholder="Ex: Café da manhã"
                    className={input}
                  />
                </label>
                <label className="block w-28">
                  <span className={lbl}>Horário</span>
                  <input
                    value={meal.time}
                    onChange={(e) => setMealField(mi, "time", e.target.value)}
                    placeholder="07:00"
                    className={input}
                  />
                </label>
                {form.meals.length > 1 && (
                  <button
                    onClick={() => removeMeal(mi)}
                    className="h-10 rounded-lg px-3 text-sm font-medium text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>

              {/* itens */}
              <div className="mt-3 space-y-2">
                {meal.items.map((it, ii) => (
                  <div
                    key={ii}
                    className="rounded-xl border border-ink/10 bg-sand/40 p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-12">
                      <input
                        value={it.food}
                        onChange={(e) =>
                          setItemField(mi, ii, "food", e.target.value)
                        }
                        placeholder="Alimento"
                        className={`${input} sm:col-span-5`}
                      />
                      <input
                        value={it.amount}
                        onChange={(e) =>
                          setItemField(mi, ii, "amount", e.target.value)
                        }
                        placeholder="Qtd (ex: 100 g)"
                        className={`${input} sm:col-span-3`}
                      />
                      <input
                        type="number"
                        min="0"
                        value={it.calories || ""}
                        onChange={(e) =>
                          setItemField(mi, ii, "calories", e.target.value)
                        }
                        placeholder="kcal"
                        className={`${input} sm:col-span-2`}
                      />
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <button
                          onClick={() => removeItem(mi, ii)}
                          className="h-10 w-full rounded-lg border border-ink/15 text-sm font-medium text-red-500 hover:bg-red-50"
                          aria-label="Remover item"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-12">
                      <input
                        type="number"
                        min="0"
                        value={it.protein || ""}
                        onChange={(e) =>
                          setItemField(mi, ii, "protein", e.target.value)
                        }
                        placeholder="Proteína (g)"
                        className={`${input} sm:col-span-3`}
                      />
                      <input
                        type="number"
                        min="0"
                        value={it.carbs || ""}
                        onChange={(e) =>
                          setItemField(mi, ii, "carbs", e.target.value)
                        }
                        placeholder="Carbo (g)"
                        className={`${input} sm:col-span-3`}
                      />
                      <input
                        type="number"
                        min="0"
                        value={it.fat || ""}
                        onChange={(e) =>
                          setItemField(mi, ii, "fat", e.target.value)
                        }
                        placeholder="Gordura (g)"
                        className={`${input} sm:col-span-3`}
                      />
                      <input
                        value={it.notes}
                        onChange={(e) =>
                          setItemField(mi, ii, "notes", e.target.value)
                        }
                        placeholder="Preparo / substituição"
                        className={`${input} sm:col-span-3`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => addItem(mi)}
                  className="text-sm font-semibold text-teal-600 hover:underline"
                >
                  + Adicionar alimento
                </button>
                {t.kcal > 0 && (
                  <span className="text-xs font-medium text-ink/50">
                    Subtotal: {Math.round(t.kcal)} kcal · P {Math.round(t.p)}g ·
                    C {Math.round(t.c)}g · G {Math.round(t.f)}g
                  </span>
                )}
              </div>
              <label className="mt-3 block">
                <span className={lbl}>Observação da refeição</span>
                <input
                  value={meal.notes}
                  onChange={(e) => setMealField(mi, "notes", e.target.value)}
                  placeholder="Ex: beber 1 copo de água antes"
                  className={input}
                />
              </label>
            </div>
          );
        })}

        <button
          onClick={addMeal}
          className="w-full rounded-xl border border-dashed border-ink/25 py-3 text-sm font-semibold text-teal-600 transition hover:border-teal-500/50 hover:bg-teal-500/5"
        >
          + Adicionar refeição
        </button>

        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <label className="block">
            <span className={lbl}>Orientações gerais</span>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              placeholder="Ex: evitar frituras, priorizar água, mastigar devagar"
              className={area}
            />
          </label>
        </div>

        {/* total do dia */}
        <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display font-bold text-ink">
              Total do dia
            </span>
            <span className="text-sm font-semibold text-teal-700">
              {Math.round(totals.kcal)} kcal · P {Math.round(totals.p)}g · C{" "}
              {Math.round(totals.c)}g · G {Math.round(totals.f)}g
            </span>
          </div>
          {target > 0 && totals.kcal > 0 && (
            <p className="mt-1 text-xs text-ink/50">
              Meta: {target} kcal ·{" "}
              <span
                className={
                  Math.abs(totals.kcal - target) <= 100
                    ? "text-teal-600"
                    : "text-amber-600"
                }
              >
                {totals.kcal - target > 0 ? "+" : ""}
                {Math.round(totals.kcal - target)} kcal vs. meta
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={saving}
            className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar plano"}
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

  // ---- lista de planos ----
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Monte o plano por refeição, com quantidades e macros. Gere o PDF para
          entregar ao paciente.
        </p>
        <button
          onClick={openNew}
          className="shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Novo plano
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
          Carregando planos...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum plano alimentar ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => {
            const t = planTotals(p.meals);
            return (
              <div
                key={p._id}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{p.name}</p>
                    {p.active && (
                      <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-600">
                        Atual
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      onClick={() => downloadPdf(p)}
                      disabled={pdfBusy === p._id}
                      className="font-medium text-teal-600 hover:underline disabled:opacity-50"
                    >
                      {pdfBusy === p._id ? "Gerando..." : "PDF"}
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="font-medium text-red-500 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                {p.goal && (
                  <p className="mt-1 text-sm text-ink/60">{p.goal}</p>
                )}
                <p className="mt-2 text-xs text-ink/50">
                  {p.meals.length} refeiç{p.meals.length !== 1 ? "ões" : "ão"}
                  {t.kcal > 0
                    ? `  ·  ${Math.round(t.kcal)} kcal/dia · P ${Math.round(
                        t.p
                      )}g · C ${Math.round(t.c)}g · G ${Math.round(t.f)}g`
                    : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
