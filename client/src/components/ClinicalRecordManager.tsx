import { useEffect, useState } from "react";
import {
  clinicalRecordApi,
  ClinicalRecord,
  ClinicalSession,
} from "../api/clinicalRecord";

// Aba "Ficha clínica" (extra saúde: psicologia, fonoaudiologia, acupuntura,
// quiropraxia): cada paciente tem queixa + avaliação e evoluções por sessão
// no formato SOAP.

const input =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500";
const area =
  "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal-500";
const lbl = "mb-1 block text-sm font-medium text-ink/70";
const small = "mb-1 block text-xs font-medium text-ink/60";

const emptySession = (): ClinicalSession => ({
  date: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  cid: "",
});

const emptyForm = () => ({
  patientName: "",
  patientPhone: "",
  complaint: "",
  history: "",
  sessions: [] as ClinicalSession[],
  nextReturn: "",
  notes: "",
});
type FormState = ReturnType<typeof emptyForm>;

export function ClinicalRecordManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    clinicalRecordApi
      .list(establishmentId)
      .then(setRecords)
      .catch(() => setError("Não foi possível carregar as fichas."))
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
  const startEdit = (r: ClinicalRecord) => {
    setForm({
      patientName: r.patientName,
      patientPhone: r.patientPhone,
      complaint: r.complaint,
      history: r.history,
      sessions: r.sessions || [],
      nextReturn: r.nextReturn || "",
      notes: r.notes,
    });
    setEditing(r._id);
    setError("");
  };
  const cancel = () => {
    setEditing(null);
    setError("");
  };

  const addSession = () =>
    set("sessions", [{ ...emptySession(), date: "" }, ...form.sessions]);
  const updateSession = (i: number, patch: Partial<ClinicalSession>) =>
    set(
      "sessions",
      form.sessions.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  const removeSession = (i: number) =>
    set(
      "sessions",
      form.sessions.filter((_, idx) => idx !== i)
    );

  const save = async () => {
    if (!form.patientName.trim()) {
      setError("Informe o nome do paciente.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      patientName: form.patientName.trim(),
      patientPhone: form.patientPhone.trim(),
      complaint: form.complaint.trim(),
      history: form.history.trim(),
      sessions: form.sessions
        .map((s) => ({
          date: s.date.trim(),
          subjective: s.subjective.trim(),
          objective: s.objective.trim(),
          assessment: s.assessment.trim(),
          plan: s.plan.trim(),
          cid: s.cid.trim(),
        }))
        .filter(
          (s) =>
            s.date || s.subjective || s.objective || s.assessment || s.plan
        ),
      nextReturn: form.nextReturn.trim(),
      notes: form.notes.trim(),
    };
    try {
      if (editing === "new") {
        const created = await clinicalRecordApi.create(establishmentId, payload);
        setRecords((l) => [created, ...l]);
      } else if (editing) {
        const up = await clinicalRecordApi.update(establishmentId, editing, payload);
        setRecords((l) => l.map((r) => (r._id === editing ? up : r)));
      }
      setEditing(null);
    } catch {
      setError("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await clinicalRecordApi.remove(establishmentId, id);
    setRecords((l) => l.filter((r) => r._id !== id));
  };

  const openPdf = async (id: string) => {
    try {
      const blob = await clinicalRecordApi.pdf(establishmentId, id);
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
          <h3 className="font-display text-lg font-bold text-ink">
            {editing === "new" ? "Nova ficha" : "Editar ficha"}
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
              <span className={lbl}>Paciente</span>
              <input
                value={form.patientName}
                onChange={(e) => set("patientName", e.target.value)}
                placeholder="Nome do paciente"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Telefone</span>
              <input
                value={form.patientPhone}
                onChange={(e) => set("patientPhone", e.target.value)}
                placeholder="(38) 99999-0000"
                className={input}
              />
            </label>
          </div>
          <label className="block">
            <span className={lbl}>Queixa principal</span>
            <input
              value={form.complaint}
              onChange={(e) => set("complaint", e.target.value)}
              placeholder="Motivo da consulta"
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Avaliação inicial / histórico</span>
            <textarea
              value={form.history}
              onChange={(e) => set("history", e.target.value)}
              rows={3}
              placeholder="Anamnese resumida, histórico relevante, objetivos..."
              className={area}
            />
          </label>

          {/* Evoluções SOAP */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink/70">
                Evoluções por sessão (SOAP)
                {form.sessions.length > 0 && (
                  <span className="ml-1 text-xs text-ink/40">
                    ({form.sessions.length})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={addSession}
                className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
              >
                + Sessão
              </button>
            </div>
            {form.sessions.length === 0 && (
              <p className="text-xs text-ink/40">
                S: relato · O: observação · A: avaliação · P: conduta.
              </p>
            )}
            <div className="space-y-3">
              {form.sessions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-ink/10 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input
                      value={s.date}
                      onChange={(e) => updateSession(i, { date: e.target.value })}
                      placeholder="Data (ex: 12/09)"
                      className="h-9 w-28 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    />
                    <input
                      value={s.cid}
                      onChange={(e) => updateSession(i, { cid: e.target.value })}
                      placeholder="CID-10 (ex: F41.1)"
                      className="h-9 flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeSession(i)}
                      className="rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                      aria-label="Remover sessão"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className={small}>S — Subjetivo</span>
                      <textarea
                        value={s.subjective}
                        onChange={(e) =>
                          updateSession(i, { subjective: e.target.value })
                        }
                        rows={2}
                        className={area}
                      />
                    </label>
                    <label className="block">
                      <span className={small}>O — Objetivo</span>
                      <textarea
                        value={s.objective}
                        onChange={(e) =>
                          updateSession(i, { objective: e.target.value })
                        }
                        rows={2}
                        className={area}
                      />
                    </label>
                    <label className="block">
                      <span className={small}>A — Avaliação</span>
                      <textarea
                        value={s.assessment}
                        onChange={(e) =>
                          updateSession(i, { assessment: e.target.value })
                        }
                        rows={2}
                        className={area}
                      />
                    </label>
                    <label className="block">
                      <span className={small}>P — Plano / conduta</span>
                      <textarea
                        value={s.plan}
                        onChange={(e) =>
                          updateSession(i, { plan: e.target.value })
                        }
                        rows={2}
                        className={area}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={lbl}>Retorno previsto</span>
            <input
              value={form.nextReturn}
              onChange={(e) => set("nextReturn", e.target.value)}
              placeholder="Ex: 15/10 ou daqui a 30 dias"
              className={input}
            />
          </label>
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
            {editing !== "new" && (
              <button
                type="button"
                onClick={() => openPdf(editing)}
                className="ml-auto h-11 rounded-xl border border-teal-500 px-6 font-semibold text-teal-600 transition hover:bg-teal-500 hover:text-white dark:text-teal-100"
              >
                Relatório PDF
              </button>
            )}
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
          {records.length} paciente{records.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={startNew}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Nova ficha
        </button>
      </div>

      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
          Nenhuma ficha ainda. Crie a primeira.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {records.map((r) => (
            <button
              key={r._id}
              onClick={() => startEdit(r)}
              className="rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate font-display font-bold text-ink">
                    {r.patientName || "Sem nome"}
                  </h4>
                  {r.complaint && (
                    <p className="truncate text-sm text-ink/60">{r.complaint}</p>
                  )}
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(r._id);
                  }}
                  className="shrink-0 text-xs font-medium text-red-500 hover:underline"
                >
                  Remover
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-teal-500/10 px-2 py-0.5 font-medium text-teal-600 dark:text-teal-100">
                  {(r.sessions || []).length} sessão
                  {(r.sessions || []).length !== 1 ? "es" : ""}
                </span>
                {r.nextReturn && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-300">
                    Retorno: {r.nextReturn}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
