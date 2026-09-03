import { useEffect, useState } from "react";
import { lessonPlanApi, LessonPlan, LessonTopic } from "../api/lessonPlan";

// Aba "Aulas" (extra da categoria aulas-particulares, modulo "aulas"):
// cada aluno tem materia, objetivo e um plano de aulas (conteudos/topicos).
// A frequencia/presenca fica na aba Matriculas (ligada a agenda real).

const input =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500";
const area =
  "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal-500";
const lbl = "mb-1 block text-sm font-medium text-ink/70";

const emptyForm = () => ({
  studentName: "",
  studentPhone: "",
  subject: "",
  goal: "",
  topics: [] as LessonTopic[],
  notes: "",
});
type FormState = ReturnType<typeof emptyForm>;

export function AulasManager({ establishmentId }: { establishmentId: string }) {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    lessonPlanApi
      .list(establishmentId)
      .then(setPlans)
      .catch(() => setError("Não foi possível carregar os alunos."))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [establishmentId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const startNew = () => {
    setForm(emptyForm());
    setEditing("new");
    setError("");
  };
  const startEdit = (p: LessonPlan) => {
    setForm({
      studentName: p.studentName,
      studentPhone: p.studentPhone,
      subject: p.subject,
      goal: p.goal,
      topics: p.topics || [],
      notes: p.notes,
    });
    setEditing(p._id);
    setError("");
  };
  const cancel = () => {
    setEditing(null);
    setError("");
  };

  // ---- plano de aulas (topicos) ----
  const addTopic = () =>
    set("topics", [...form.topics, { title: "", done: false, date: "" }]);
  const updateTopic = (i: number, patch: Partial<LessonTopic>) =>
    set(
      "topics",
      form.topics.map((t, idx) => (idx === i ? { ...t, ...patch } : t))
    );
  const removeTopic = (i: number) =>
    set(
      "topics",
      form.topics.filter((_, idx) => idx !== i)
    );

  const save = async () => {
    if (!form.studentName.trim()) {
      setError("Informe o nome do aluno.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      studentName: form.studentName.trim(),
      studentPhone: form.studentPhone.trim(),
      subject: form.subject.trim(),
      goal: form.goal.trim(),
      topics: form.topics
        .map((t) => ({
          title: t.title.trim(),
          done: t.done,
          date: t.date.trim(),
        }))
        .filter((t) => t.title !== "" || t.date !== ""),
      notes: form.notes.trim(),
    };
    try {
      if (editing === "new") {
        const created = await lessonPlanApi.create(establishmentId, payload);
        setPlans((list) => [created, ...list]);
      } else if (editing) {
        const updated = await lessonPlanApi.update(
          establishmentId,
          editing,
          payload
        );
        setPlans((list) => list.map((p) => (p._id === editing ? updated : p)));
      }
      setEditing(null);
    } catch {
      setError("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await lessonPlanApi.remove(establishmentId, id);
    setPlans((list) => list.filter((p) => p._id !== id));
  };

  // ---- editor ----
  if (editing) {
    const doneCount = form.topics.filter((t) => t.done).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">
            {editing === "new" ? "Novo aluno" : "Editar aluno"}
          </h3>
          <button
            onClick={cancel}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
          >
            Voltar
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>Aluno</span>
              <input
                value={form.studentName}
                onChange={(e) => set("studentName", e.target.value)}
                placeholder="Nome do aluno"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Telefone</span>
              <input
                value={form.studentPhone}
                onChange={(e) => set("studentPhone", e.target.value)}
                placeholder="(38) 99999-0000"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Matéria</span>
              <input
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
                placeholder="Ex: Matemática, Inglês, Violão"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Objetivo</span>
              <input
                value={form.goal}
                onChange={(e) => set("goal", e.target.value)}
                placeholder="Ex: Preparação para o ENEM"
                className={input}
              />
            </label>
          </div>

          {/* Plano de aulas */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink/70">
                Plano de aulas{" "}
                {form.topics.length > 0 && (
                  <span className="text-xs text-ink/40">
                    ({doneCount}/{form.topics.length} concluídos)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={addTopic}
                className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
              >
                + Aula
              </button>
            </div>
            {form.topics.length === 0 && (
              <p className="text-xs text-ink/40">Nenhum conteúdo ainda.</p>
            )}
            <div className="space-y-2">
              {form.topics.map((t, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => updateTopic(i, { done: e.target.checked })}
                    className="h-5 w-5 shrink-0 accent-teal-500"
                    title="Concluído"
                  />
                  <input
                    value={t.title}
                    onChange={(e) => updateTopic(i, { title: e.target.value })}
                    placeholder="Conteúdo / tópico da aula"
                    className={`h-9 min-w-[140px] flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500 ${
                      t.done ? "line-through text-ink/40" : ""
                    }`}
                  />
                  <input
                    value={t.date}
                    onChange={(e) => updateTopic(i, { date: e.target.value })}
                    placeholder="Data"
                    className="h-9 w-24 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeTopic(i)}
                    className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                    aria-label="Remover aula"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/40">
              A presença dos alunos é registrada na aba Matrículas (ligada à
              agenda).
            </p>
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

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
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
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {plans.length} aluno{plans.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={startNew}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Novo aluno
        </button>
      </div>

      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
          Nenhum aluno ainda. Cadastre o primeiro.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => {
            const doneCount = (p.topics || []).filter((t) => t.done).length;
            return (
              <button
                key={p._id}
                onClick={() => startEdit(p)}
                className="rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="truncate font-display font-bold text-ink">
                      {p.studentName || "Sem nome"}
                    </h4>
                    {p.subject && (
                      <p className="truncate text-sm text-ink/60">{p.subject}</p>
                    )}
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(p._id);
                    }}
                    className="shrink-0 text-xs font-medium text-red-500 hover:underline"
                  >
                    Remover
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-teal-500/10 px-2 py-0.5 font-medium text-teal-600 dark:text-teal-100">
                    {doneCount}/{(p.topics || []).length} aulas
                  </span>
                  {p.goal && (
                    <span className="truncate rounded-full bg-ink/10 px-2 py-0.5 font-medium text-ink/60">
                      {p.goal}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
