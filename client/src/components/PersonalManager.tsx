import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import {
  personalApi,
  PersonalAssessment,
  PersonalProfile,
  PersonalWorkout,
  WorkoutDay,
  BodyMeasurements,
  AssessmentPayload,
  MEASURE_FIELDS,
  emptyMeasurements,
} from "../api/personal";
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

// IMC a partir de peso (kg) e altura (cm)
function bmi(weight: number, height: number): number {
  if (!weight || !height) return 0;
  return weight / Math.pow(height / 100, 2);
}

// ============ ENTRADA: lista de alunos ============
export function PersonalManager({
  establishment,
}: {
  establishment: Establishment;
}) {
  const establishmentId = establishment._id;
  const [students, setStudents] = useState<EstablishmentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EstablishmentClient | null>(null);

  useEffect(() => {
    setLoading(true);
    recordApi
      .clients(establishmentId)
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, query]);

  if (selected) {
    return (
      <StudentPanel
        establishmentId={establishmentId}
        student={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar aluno pelo nome..."
        className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500"
      />
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando alunos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            {students.length === 0
              ? "Nenhum aluno ainda. A ficha fica disponível para quem já teve atendimento aqui."
              : "Nenhum aluno encontrado com esse nome."}
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

// ============ PAINEL DO ALUNO ============
type StudentView = "ficha" | "avaliacoes" | "evolucao" | "treinos" | "retornos";

function StudentPanel({
  establishmentId,
  student,
  onBack,
}: {
  establishmentId: string;
  student: EstablishmentClient;
  onBack: () => void;
}) {
  const clientId = student._id;
  const [view, setView] = useState<StudentView>("ficha");

  // avaliacoes ficam no painel para serem compartilhadas entre "avaliacoes" e
  // "evolucao" (o grafico usa a mesma lista)
  const [assessments, setAssessments] = useState<PersonalAssessment[]>([]);
  const [loadingA, setLoadingA] = useState(true);

  useEffect(() => {
    setLoadingA(true);
    personalApi
      .listAssessments(establishmentId, clientId)
      .then(setAssessments)
      .catch(() => setAssessments([]))
      .finally(() => setLoadingA(false));
  }, [establishmentId, clientId]);

  const tabs: [StudentView, string][] = [
    ["ficha", "Ficha / anamnese"],
    ["avaliacoes", "Avaliações e medidas"],
    ["evolucao", "Evolução"],
    ["treinos", "Treinos"],
    ["retornos", "Retornos"],
  ];

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:underline"
      >
        ← Voltar aos alunos
      </button>
      <h2 className="font-display text-xl font-bold text-ink">{student.name}</h2>

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
          <ProfileSection establishmentId={establishmentId} clientId={clientId} />
        )}
        {view === "avaliacoes" && (
          <AssessmentsSection
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
        {view === "treinos" && (
          <WorkoutsSection
            establishmentId={establishmentId}
            clientId={clientId}
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

// ============ FICHA / ANAMNESE ============
const PARQ_QUESTIONS = [
  "Algum médico já disse que você tem um problema cardíaco e que só deveria fazer atividade física supervisionada?",
  "Você sente dor no peito ao praticar atividade física?",
  "No último mês, sentiu dor no peito ao praticar atividade física?",
  "Você perde o equilíbrio por tontura ou já perdeu a consciência?",
  "Tem algum problema ósseo ou articular que poderia piorar com atividade física?",
  "Toma algum medicamento para pressão arterial ou problema cardíaco?",
  "Conhece algum outro motivo pelo qual não deveria praticar atividade física?",
];

function ProfileSection({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [goal, setGoal] = useState("");
  const [parq, setParq] = useState<boolean[]>(Array(7).fill(false));
  const [parqNotes, setParqNotes] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [photos, setPhotos] = useState<
    { url: string; date: string; note: string }[]
  >([]);

  useEffect(() => {
    setLoading(true);
    personalApi
      .getProfile(establishmentId, clientId)
      .then((p: PersonalProfile) => {
        setGoal(p.goal || "");
        setParq(
          Array.from({ length: 7 }, (_, i) => Boolean((p.parq || [])[i]))
        );
        setParqNotes(p.parqNotes || "");
        setRestrictions(p.restrictions || "");
        setHealthNotes(p.healthNotes || "");
        setPhotos(
          (p.photos || []).map((ph) => ({
            url: ph.url,
            date: ph.date ? toDateInput(new Date(ph.date)) : toDateInput(new Date()),
            note: ph.note || "",
          }))
        );
      })
      .catch(() => setError("Não foi possível carregar a ficha."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const toggleParq = (i: number) =>
    setParq((arr) => arr.map((v, idx) => (idx === i ? !v : v)));

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

  const save = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      await personalApi.updateProfile(establishmentId, clientId, {
        goal: goal.trim(),
        parq,
        parqNotes: parqNotes.trim(),
        restrictions: restrictions.trim(),
        healthNotes: healthNotes.trim(),
        photos: photos.map((p) => ({
          url: p.url,
          date: p.date || undefined,
          note: p.note.trim(),
        })),
      });
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch {
      setError("Não foi possível salvar a ficha.");
    } finally {
      setSaving(false);
    }
  };

  const hasParqYes = parq.some(Boolean);

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
        <h3 className="font-display font-bold text-ink">Objetivo</h3>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder="Ex: hipertrofia, emagrecimento, condicionamento, reabilitação..."
          className={`mt-2 ${area}`}
        />
      </div>

      {/* PAR-Q */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">
          Anamnese — PAR-Q (prontidão para atividade física)
        </h3>
        {hasParqYes && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <span aria-hidden="true">⚠️</span>
            <span>
              Há resposta "Sim" no PAR-Q. Considere liberação/avaliação médica
              antes de iniciar.
            </span>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {PARQ_QUESTIONS.map((q, i) => (
            <label
              key={i}
              className="flex items-start gap-3 rounded-lg border border-ink/10 bg-sand/40 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={parq[i]}
                onChange={() => toggleParq(i)}
                className="mt-0.5 h-4 w-4 accent-teal-500"
              />
              <span className="text-sm text-ink/80">
                {i + 1}. {q}
              </span>
            </label>
          ))}
        </div>
        <label className="mt-3 block">
          <span className={lbl}>Detalhe das respostas "Sim"</span>
          <textarea
            value={parqNotes}
            onChange={(e) => setParqNotes(e.target.value)}
            rows={2}
            className={area}
          />
        </label>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <label className="block">
          <span className={lbl}>Restrições / lesões / limitações</span>
          <textarea
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            rows={2}
            placeholder="Ex: hérnia de disco L5-S1, dor no ombro direito, evitar impacto"
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
                  placeholder="Legenda (ex: frente, costas)"
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
            folder="personal"
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

// ============ AVALIACOES E MEDIDAS ============
const emptyAssessmentForm = () => ({
  date: toDateInput(new Date()),
  weight: "",
  height: "",
  bodyFat: "",
  restingHr: "",
  measurements: emptyMeasurements(),
  notes: "",
});
type AssessmentForm = ReturnType<typeof emptyAssessmentForm>;

function AssessmentsSection({
  establishmentId,
  clientId,
  items,
  loading,
  setItems,
}: {
  establishmentId: string;
  clientId: string;
  items: PersonalAssessment[];
  loading: boolean;
  setItems: React.Dispatch<React.SetStateAction<PersonalAssessment[]>>;
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
  const openEdit = (a: PersonalAssessment) => {
    setEditingId(a._id);
    setForm({
      date: toDateInput(new Date(a.date)),
      weight: a.weight ? String(a.weight) : "",
      height: a.height ? String(a.height) : "",
      bodyFat: a.bodyFat ? String(a.bodyFat) : "",
      restingHr: a.restingHr ? String(a.restingHr) : "",
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
      restingHr: Number(form.restingHr) || 0,
      measurements: form.measurements,
      notes: form.notes.trim(),
    };
    try {
      if (editingId) {
        const updated = await personalApi.updateAssessment(
          establishmentId,
          clientId,
          editingId,
          payload
        );
        setItems((list) =>
          list
            .map((x) => (x._id === editingId ? updated : x))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
      } else {
        const created = await personalApi.createAssessment(
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

  const remove = async (a: PersonalAssessment) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== a._id));
    try {
      await personalApi.removeAssessment(establishmentId, clientId, a._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover a avaliação.");
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Avaliação física com medidas — registre periodicamente para comparar.
        </p>
        {!showForm && (
          <button
            onClick={openNew}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
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

          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className={lbl}>FC repouso (bpm)</span>
              <input
                type="number"
                min="0"
                value={form.restingHr}
                onChange={(e) => setField("restingHr", e.target.value)}
                className={input}
              />
            </label>
            {Number(form.weight) > 0 && Number(form.height) > 0 && (
              <div className="flex flex-col justify-end">
                <span className={lbl}>IMC</span>
                <div className="flex h-10 items-center rounded-lg bg-teal-500/10 px-3 text-sm font-semibold text-teal-600 dark:text-teal-100">
                  {bmi(Number(form.weight), Number(form.height)).toFixed(1)}
                </div>
              </div>
            )}
          </div>

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

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="h-10 rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? "Salvando..." : editingId ? "Salvar" : "Criar avaliação"}
            </button>
            <button
              onClick={cancel}
              className="h-10 rounded-xl border border-ink/15 px-4 text-sm font-medium text-ink/70 transition hover:bg-sand"
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
        <div className="space-y-3">
          {items.map((a) => {
            const measures = MEASURE_FIELDS.filter(
              (m) => (a.measurements?.[m.key] || 0) > 0
            );
            const imcVal = bmi(a.weight, a.height);
            return (
              <div
                key={a._id}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-ink">{fmtDate(a.date)}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openEdit(a)}
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-sand"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {a.weight > 0 && (
                    <Chip label="Peso" value={`${a.weight} kg`} />
                  )}
                  {a.height > 0 && (
                    <Chip label="Altura" value={`${a.height} cm`} />
                  )}
                  {imcVal > 0 && (
                    <Chip label="IMC" value={imcVal.toFixed(1)} />
                  )}
                  {a.bodyFat > 0 && (
                    <Chip label="Gordura" value={`${a.bodyFat}%`} />
                  )}
                  {a.restingHr > 0 && (
                    <Chip label="FC rep." value={`${a.restingHr} bpm`} />
                  )}
                </div>
                {measures.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {measures.map((m) => (
                      <Chip
                        key={m.key}
                        label={m.label}
                        value={`${a.measurements[m.key]} cm`}
                        soft
                      />
                    ))}
                  </div>
                )}
                {a.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink/70">
                    {a.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  soft = false,
}: {
  label: string;
  value: string;
  soft?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
        soft
          ? "border border-ink/10 bg-sand/60 text-ink/70"
          : "bg-teal-500/10 text-teal-700 dark:text-teal-100"
      }`}
    >
      <span className="font-medium text-ink/50">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

// ============ EVOLUCAO (grafico + comparacao) ============
type MetricKey = "weight" | "bodyFat" | "imc" | keyof BodyMeasurements;
interface Metric {
  key: MetricKey;
  label: string;
  unit: string;
  get: (a: PersonalAssessment) => number;
}
const METRICS: Metric[] = [
  { key: "weight", label: "Peso", unit: "kg", get: (a) => a.weight },
  { key: "bodyFat", label: "% Gordura", unit: "%", get: (a) => a.bodyFat },
  {
    key: "imc",
    label: "IMC",
    unit: "",
    get: (a) => bmi(a.weight, a.height),
  },
  ...MEASURE_FIELDS.map((m) => ({
    key: m.key as MetricKey,
    label: m.label,
    unit: "cm",
    get: (a: PersonalAssessment) => a.measurements?.[m.key] || 0,
  })),
];

function EvolutionSection({
  items,
  loading,
}: {
  items: PersonalAssessment[];
  loading: boolean;
}) {
  const [metricKey, setMetricKey] = useState<MetricKey>("weight");
  const metric = METRICS.find((m) => m.key === metricKey) || METRICS[0];

  // avaliacoes em ordem cronologica (antiga -> recente)
  const chrono = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [items]
  );

  // pontos com valor > 0 para a metrica escolhida
  const points = useMemo(
    () =>
      chrono
        .map((a) => ({ date: a.date, value: metric.get(a) }))
        .filter((p) => p.value > 0),
    [chrono, metric]
  );

  // comparacao entre duas avaliacoes
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
        Registre avaliações na aba "Avaliações e medidas" para ver a evolução.
      </div>
    );

  return (
    <div className="space-y-5">
      {/* grafico */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-bold text-ink">Gráfico de evolução</h3>
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

      {/* comparacao */}
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

// grafico de linha simples em SVG (sem dependencias)
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
  const x = (i: number) =>
    padL + (i / spanX) * (W - padL - padR);
  const y = (v: number) =>
    padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
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
        <text
          x={padL}
          y={11}
          className="fill-ink/40"
          fontSize={9}
        >
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
  a: PersonalAssessment;
  b: PersonalAssessment;
}) {
  // metricas onde ao menos uma das duas tem valor
  const rows = METRICS.map((m) => {
    const va = m.get(a);
    const vb = m.get(b);
    return { m, va, vb, delta: vb - va };
  }).filter((r) => r.va > 0 || r.vb > 0);

  const dp = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1));

  // para peso/gordura/IMC/medidas, cair (delta<0) mostra verde (reducao);
  // isso e so uma cor neutra de tendencia, nao um julgamento.
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
                {m.unit ? (
                  <span className="text-ink/40"> ({m.unit})</span>
                ) : null}
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
                {va > 0 && vb > 0
                  ? `${delta > 0 ? "+" : ""}${dp(delta)}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ TREINOS ============
const emptyExercise = () => ({
  name: "",
  sets: "",
  reps: "",
  load: "",
  rest: "",
  notes: "",
});
const emptyDay = (): WorkoutDay => ({
  label: "",
  focus: "",
  exercises: [emptyExercise()],
});
const emptyWorkoutForm = () => ({
  name: "",
  goal: "",
  active: true,
  notes: "",
  days: [emptyDay()] as WorkoutDay[],
});
type WorkoutForm = ReturnType<typeof emptyWorkoutForm>;

function WorkoutsSection({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [items, setItems] = useState<PersonalWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<WorkoutForm>(emptyWorkoutForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    personalApi
      .listWorkouts(establishmentId, clientId)
      .then(setItems)
      .catch(() => setError("Não foi possível carregar os treinos."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const startNew = () => {
    setForm(emptyWorkoutForm());
    setEditing("new");
    setError(null);
  };
  const startEdit = (w: PersonalWorkout) => {
    setForm({
      name: w.name || "",
      goal: w.goal || "",
      active: w.active,
      notes: w.notes || "",
      days:
        w.days && w.days.length > 0
          ? w.days.map((d) => ({
              label: d.label,
              focus: d.focus,
              exercises:
                d.exercises && d.exercises.length > 0
                  ? d.exercises.map((e) => ({ ...e }))
                  : [emptyExercise()],
            }))
          : [emptyDay()],
    });
    setEditing(w._id);
    setError(null);
  };
  const cancel = () => {
    setEditing(null);
    setError(null);
  };

  // ---- edicao dos dias/exercicios ----
  const setDay = (di: number, patch: Partial<WorkoutDay>) =>
    setForm((f) => ({
      ...f,
      days: f.days.map((d, i) => (i === di ? { ...d, ...patch } : d)),
    }));
  const addDay = () =>
    setForm((f) => ({ ...f, days: [...f.days, emptyDay()] }));
  const removeDay = (di: number) =>
    setForm((f) => ({ ...f, days: f.days.filter((_, i) => i !== di) }));
  const addExercise = (di: number) =>
    setForm((f) => ({
      ...f,
      days: f.days.map((d, i) =>
        i === di ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d
      ),
    }));
  const setExercise = (
    di: number,
    ei: number,
    patch: Partial<ReturnType<typeof emptyExercise>>
  ) =>
    setForm((f) => ({
      ...f,
      days: f.days.map((d, i) =>
        i === di
          ? {
              ...d,
              exercises: d.exercises.map((e, j) =>
                j === ei ? { ...e, ...patch } : e
              ),
            }
          : d
      ),
    }));
  const removeExercise = (di: number, ei: number) =>
    setForm((f) => ({
      ...f,
      days: f.days.map((d, i) =>
        i === di
          ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) }
          : d
      ),
    }));

  const save = async () => {
    if (!form.name.trim()) {
      setError("Dê um nome ao treino.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      goal: form.goal.trim(),
      active: form.active,
      notes: form.notes.trim(),
      days: form.days,
    };
    try {
      if (editing === "new") {
        const created = await personalApi.createWorkout(
          establishmentId,
          clientId,
          payload
        );
        setItems((list) => syncActive([created, ...list], created));
      } else if (editing) {
        const updated = await personalApi.updateWorkout(
          establishmentId,
          clientId,
          editing,
          payload
        );
        setItems((list) =>
          syncActive(
            list.map((w) => (w._id === editing ? updated : w)),
            updated
          )
        );
      }
      setEditing(null);
    } catch {
      setError("Não foi possível salvar o treino.");
    } finally {
      setSaving(false);
    }
  };

  // reflete no cliente a regra do servidor: so um treino ativo por aluno
  const syncActive = (list: PersonalWorkout[], changed: PersonalWorkout) =>
    changed.active
      ? list.map((w) =>
          w._id === changed._id ? w : { ...w, active: false }
        )
      : list;

  const remove = async (w: PersonalWorkout) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== w._id));
    try {
      await personalApi.removeWorkout(establishmentId, clientId, w._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover o treino.");
    }
  };

  const openPdf = async (id: string) => {
    try {
      const blob = await personalApi.workoutPdf(establishmentId, clientId, id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("Não foi possível gerar o PDF.");
    }
  };

  // ---- editor ----
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-lg font-bold text-ink">
            {editing === "new" ? "Novo treino" : "Editar treino"}
          </h4>
          <button
            onClick={cancel}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
          >
            Voltar
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>Nome do treino</span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ex: Hipertrofia — Fase 1"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Objetivo (opcional)</span>
              <input
                value={form.goal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, goal: e.target.value }))
                }
                placeholder="Ex: ganho de massa"
                className={input}
              />
            </label>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
              className="h-4 w-4 accent-teal-500"
            />
            <span className="text-sm text-ink/70">
              Treino atual do aluno (desativa os outros)
            </span>
          </label>

          {/* dias */}
          {form.days.map((day, di) => (
            <div
              key={di}
              className="rounded-xl border border-ink/10 bg-sand/40 p-3"
            >
              <div className="mb-2 grid gap-2 sm:grid-cols-2">
                <input
                  value={day.label}
                  onChange={(e) => setDay(di, { label: e.target.value })}
                  placeholder="Dia (ex: A, Segunda)"
                  className="h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                />
                <input
                  value={day.focus}
                  onChange={(e) => setDay(di, { focus: e.target.value })}
                  placeholder="Foco (ex: Peito e tríceps)"
                  className="h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                />
              </div>

              {/* exercicios */}
              <div className="space-y-2">
                {day.exercises.map((ex, ei) => (
                  <div
                    key={ei}
                    className="rounded-lg border border-ink/10 bg-white p-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={ex.name}
                        onChange={(e) =>
                          setExercise(di, ei, { name: e.target.value })
                        }
                        placeholder="Exercício"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeExercise(di, ei)}
                        className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                        aria-label="Remover exercício"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <input
                        value={ex.sets}
                        onChange={(e) =>
                          setExercise(di, ei, { sets: e.target.value })
                        }
                        placeholder="Séries"
                        className="h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                      />
                      <input
                        value={ex.reps}
                        onChange={(e) =>
                          setExercise(di, ei, { reps: e.target.value })
                        }
                        placeholder="Reps"
                        className="h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                      />
                      <input
                        value={ex.load}
                        onChange={(e) =>
                          setExercise(di, ei, { load: e.target.value })
                        }
                        placeholder="Carga"
                        className="h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                      />
                      <input
                        value={ex.rest}
                        onChange={(e) =>
                          setExercise(di, ei, { rest: e.target.value })
                        }
                        placeholder="Descanso"
                        className="h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                      />
                    </div>
                    <input
                      value={ex.notes}
                      onChange={(e) =>
                        setExercise(di, ei, { notes: e.target.value })
                      }
                      placeholder="Observação / cadência (opcional)"
                      className="mt-2 h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => addExercise(di)}
                  className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
                >
                  + Exercício
                </button>
                {form.days.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDay(di)}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Remover dia
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addDay}
            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-sand"
          >
            + Dia de treino
          </button>

          <label className="block">
            <span className={lbl}>Orientações gerais</span>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              placeholder="Ex: aquecimento 5min, alongar ao final, progressão semanal..."
              className={area}
            />
          </label>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar treino"}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="h-11 rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- lista ----
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Fichas de treino do aluno. Gere o PDF para enviar/imprimir.
        </p>
        <button
          onClick={startNew}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Novo treino
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
          Carregando treinos...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum treino ainda. Crie o primeiro.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((w) => (
            <div
              key={w._id}
              className="rounded-2xl border border-ink/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-bold text-ink">{w.name}</p>
                    {w.active && (
                      <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-xs font-semibold text-teal-600 dark:text-teal-100">
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {w.days.length} dia{w.days.length !== 1 ? "s" : ""}
                    {w.goal ? ` · ${w.goal}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => openPdf(w._id)}
                    className="rounded-lg border border-teal-500 px-3 py-1.5 text-xs font-semibold text-teal-600 transition hover:bg-teal-500 hover:text-white dark:text-teal-100"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => startEdit(w)}
                    className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-sand"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => remove(w)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
              </div>

              {w.days.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {w.days.map((d, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-ink/10 bg-sand/60 px-2.5 py-1 text-xs text-ink/70"
                    >
                      {[d.label, d.focus].filter(Boolean).join(" · ") ||
                        `Dia ${i + 1}`}{" "}
                      ({d.exercises.length})
                    </span>
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
