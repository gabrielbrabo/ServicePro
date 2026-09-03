import { useEffect, useState } from "react";
import {
  constructionProjectApi,
  ConstructionProject,
  ProjectStatus,
  ProjectFrequency,
  ProjectMeasurement,
} from "../api/constructionProject";
import { formatPrice } from "../lib/time";
import { catalogApi, Service } from "../api/catalog";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import { professionalApi, Professional } from "../api/professional";
import { FreeSlotSelect } from "./FreeSlotSelect";

// Aba "Obras" (extra da categoria reformas-construcao, modulo "obra"): cada obra
// tem orcamento por ETAPAS (valor + avanco), MEDICOES (boletins que faturam o
// avanco e lancam no caixa) e visitas de acompanhamento na AGENDA (recorrentes,
// igual as matriculas/manutencao).

const input =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500";
const area =
  "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal-500";
const lbl = "mb-1 block text-sm font-medium text-ink/70";

const STATUS: { key: ProjectStatus; label: string; cls: string }[] = [
  { key: "orcamento", label: "Orçamento", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  { key: "em_andamento", label: "Em andamento", cls: "bg-teal-500/15 text-teal-600 dark:text-teal-100" },
  { key: "concluida", label: "Concluída", cls: "bg-teal-500/25 text-teal-700 dark:text-teal-100" },
  { key: "cancelada", label: "Cancelada", cls: "bg-red-500/10 text-red-600 dark:text-red-300" },
];
const statusMeta = (s: ProjectStatus) => STATUS.find((x) => x.key === s) || STATUS[0];

const FREQUENCIES: { key: ProjectFrequency; label: string }[] = [
  { key: "diaria", label: "Diária (dias seguidos)" },
  { key: "semanal", label: "Semanal" },
  { key: "quinzenal", label: "Quinzenal" },
  { key: "mensal", label: "Mensal" },
  { key: "bimestral", label: "Bimestral" },
  { key: "trimestral", label: "Trimestral" },
  { key: "personalizada", label: "Personalizada" },
];

function addByFrequency(base: Date, freq: ProjectFrequency, i: number): Date {
  const d = new Date(base);
  if (freq === "diaria") d.setDate(d.getDate() + i);
  else if (freq === "semanal") d.setDate(d.getDate() + 7 * i);
  else if (freq === "quinzenal") d.setDate(d.getDate() + 14 * i);
  else if (freq === "mensal") d.setMonth(d.getMonth() + i);
  else if (freq === "bimestral") d.setMonth(d.getMonth() + 2 * i);
  else if (freq === "trimestral") d.setMonth(d.getMonth() + 3 * i);
  return d;
}

const num = (v: unknown) => Number(v) || 0;

const emptyForm = () => ({
  client: "",
  clientName: "",
  clientPhone: "",
  title: "",
  location: "",
  status: "orcamento" as ProjectStatus,
  stages: [] as { name: string; value: string; progress: number }[],
  service: "",
  professional: "",
  startDate: "",
  time: "08:00",
  frequency: "mensal" as ProjectFrequency,
  visitsCount: 4,
  seriesId: null as string | null,
  measurements: [] as ProjectMeasurement[],
  notes: "",
});
type FormState = ReturnType<typeof emptyForm>;

export function ObrasManager({ establishmentId }: { establishmentId: string }) {
  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<EstablishmentClient[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measureNote, setMeasureNote] = useState("");
  const [measureAmount, setMeasureAmount] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const hasTeam = pros.length > 0;

  const load = () => {
    setLoading(true);
    Promise.all([
      constructionProjectApi.list(establishmentId),
      catalogApi.byEstablishment(establishmentId).catch(() => []),
      recordApi.clients(establishmentId).catch(() => []),
      professionalApi.list(establishmentId).catch(() => []),
    ])
      .then(([pjs, svcs, cls, prs]) => {
        setProjects(pjs);
        setServices(svcs.filter((s) => s.kind !== "aula"));
        setClients(cls);
        setPros(prs);
      })
      .catch(() => setError("Não foi possível carregar os dados."))
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
    setMsg("");
  };
  const startEdit = (p: ConstructionProject) => {
    setForm({
      client: p.client || "",
      clientName: p.clientName,
      clientPhone: p.clientPhone,
      title: p.title,
      location: p.location,
      status: p.status,
      stages: (p.stages || []).map((e) => ({
        name: e.name,
        value: e.value ? String(e.value) : "",
        progress: e.progress || 0,
      })),
      service: p.service || "",
      professional: p.professional || "",
      startDate: p.startDate,
      time: p.time || "08:00",
      frequency: p.frequency,
      visitsCount: p.visitsCount || 4,
      seriesId: p.seriesId,
      measurements: p.measurements || [],
      notes: p.notes,
    });
    setEditing(p._id);
    setError("");
    setMsg("");
  };
  const cancel = () => {
    setEditing(null);
    setError("");
    setMsg("");
  };

  const pickClient = (id: string) => {
    const c = clients.find((x) => x._id === id);
    setForm((f) => ({ ...f, client: id, clientName: c ? c.name : f.clientName }));
  };

  // ---- etapas ----
  const addStage = () =>
    set("stages", [...form.stages, { name: "", value: "", progress: 0 }]);
  const updateStage = (
    i: number,
    patch: Partial<{ name: string; value: string; progress: number }>
  ) =>
    set(
      "stages",
      form.stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  const removeStage = (i: number) =>
    set(
      "stages",
      form.stages.filter((_, idx) => idx !== i)
    );

  const budget = form.stages.reduce((s, e) => s + num(e.value), 0);
  const executed = form.stages.reduce(
    (s, e) => s + num(e.value) * (Math.min(100, Math.max(0, e.progress)) / 100),
    0
  );
  const billed = form.measurements.reduce((s, m) => s + m.amount, 0);
  const aMedir = Math.max(0, executed - billed);
  const pctBudget = budget > 0 ? Math.round((executed / budget) * 100) : 0;

  const payloadFromForm = () => ({
    client: form.client || null,
    clientName: form.clientName.trim(),
    clientPhone: form.clientPhone.trim(),
    title: form.title.trim(),
    location: form.location.trim(),
    status: form.status,
    stages: form.stages
      .map((s) => ({
        name: s.name.trim(),
        value: Math.max(0, num(s.value)),
        progress: Math.min(100, Math.max(0, Math.floor(s.progress))),
      }))
      .filter((s) => s.name !== "" || s.value > 0),
    service: form.service || null,
    professional: form.professional || null,
    startDate: form.startDate,
    time: form.time,
    frequency: form.frequency,
    visitsCount: form.visitsCount,
    notes: form.notes.trim(),
  });

  const persist = async (): Promise<ConstructionProject | null> => {
    if (!form.title.trim() && !form.clientName.trim()) {
      setError("Informe o título ou o cliente.");
      return null;
    }
    setSaving(true);
    setError("");
    try {
      const payload = payloadFromForm();
      let saved: ConstructionProject;
      if (editing === "new") {
        saved = await constructionProjectApi.create(establishmentId, payload);
        setProjects((list) => [saved, ...list]);
        setEditing(saved._id);
      } else if (editing) {
        saved = await constructionProjectApi.update(establishmentId, editing, payload);
        setProjects((list) => list.map((p) => (p._id === editing ? saved : p)));
      } else {
        return null;
      }
      set("seriesId", saved.seriesId);
      set("measurements", saved.measurements);
      return saved;
    } catch {
      setError("Não foi possível salvar.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ---- agenda ----
  const canSchedule = () =>
    !!form.client &&
    !!form.service &&
    !!form.startDate &&
    !!form.time &&
    form.frequency !== "personalizada" &&
    (!hasTeam || !!form.professional);

  const computeSlots = (): string[] => {
    const [y, m, d] = form.startDate.split("-").map(Number);
    const [hh, mm] = form.time.split(":").map(Number);
    if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return [];
    const count = Math.min(53, Math.max(1, form.visitsCount || 1));
    const base = new Date(y, m - 1, d, hh, mm, 0, 0);
    return Array.from({ length: count }, (_, i) =>
      addByFrequency(base, form.frequency, i).toISOString()
    );
  };

  const doSchedule = async (id: string) => {
    const slots = computeSlots();
    if (slots.length === 0) return;
    setScheduling(true);
    setMsg("");
    try {
      const r = await constructionProjectApi.schedule(establishmentId, id, slots);
      setProjects((list) => list.map((p) => (p._id === id ? r.project : p)));
      set("seriesId", r.seriesId);
      setMsg(
        `${r.createdCount} diária(s) agendada(s) na agenda` +
          (r.skippedCount ? ` · ${r.skippedCount} pulada(s)` : "")
      );
    } catch {
      setError(
        "Obra salva, mas não foi possível gerar as visitas. Verifique serviço, profissional e disponibilidade."
      );
    } finally {
      setScheduling(false);
    }
  };

  const save = async () => {
    const p = await persist();
    if (!p) return;
    if (!p.seriesId && canSchedule()) {
      await doSchedule(p._id);
      return;
    }
    setEditing(null);
  };

  const unscheduleNow = async () => {
    if (!editing || editing === "new") return;
    setScheduling(true);
    setMsg("");
    try {
      const updated = await constructionProjectApi.unschedule(establishmentId, editing);
      setProjects((list) => list.map((p) => (p._id === editing ? updated : p)));
      set("seriesId", null);
      setMsg("Diárias futuras canceladas na agenda.");
    } catch {
      setError("Não foi possível cancelar as visitas.");
    } finally {
      setScheduling(false);
    }
  };

  // ---- medicao ----
  const registrarMedicao = async () => {
    const p = await persist();
    if (!p) return;
    setMeasuring(true);
    setMsg("");
    try {
      const amt = Number(measureAmount);
      const updated = await constructionProjectApi.measure(establishmentId, p._id, {
        note: measureNote.trim() || undefined,
        amount: amt > 0 ? amt : undefined,
      });
      setProjects((list) => list.map((x) => (x._id === p._id ? updated : x)));
      set("measurements", updated.measurements);
      setMeasureNote("");
      setMeasureAmount("");
      const last = updated.measurements[updated.measurements.length - 1];
      setMsg(
        `Medição registrada: ${formatPrice(last.amount)}` +
          (last.postedToCash
            ? " · lançada no caixa"
            : " · caixa fechado (lance manualmente)")
      );
    } catch {
      setError("Não foi possível registrar a medição — sem avanço novo desde a última?");
    } finally {
      setMeasuring(false);
    }
  };

  const remove = async (id: string) => {
    await constructionProjectApi.remove(establishmentId, id);
    setProjects((list) => list.filter((p) => p._id !== id));
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  // ---- editor ----
  if (editing) {
    const scheduled = !!form.seriesId;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">
            {editing === "new" ? "Nova obra" : "Editar obra"}
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
            <label className="block sm:col-span-2">
              <span className={lbl}>Nome da obra</span>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex: Reforma cozinha - Ap. 302"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Cliente</span>
              <select
                value={form.client}
                onChange={(e) => pickClient(e.target.value)}
                className={input}
              >
                <option value="">Selecione...</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <span className="mt-1 block text-xs text-ink/40">
                  Só aparecem clientes que já agendaram aqui.
                </span>
              )}
            </label>
            <label className="block">
              <span className={lbl}>Telefone (opcional)</span>
              <input
                value={form.clientPhone}
                onChange={(e) => set("clientPhone", e.target.value)}
                placeholder="(38) 99999-0000"
                className={input}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={lbl}>Local / endereço</span>
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Endereço da obra"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Status</span>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as ProjectStatus)}
                className={input}
              >
                {STATUS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Orcamento por etapas */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink/70">
                Orçamento por etapas
              </span>
              <button
                type="button"
                onClick={addStage}
                className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
              >
                + Etapa
              </button>
            </div>
            {form.stages.length === 0 && (
              <p className="text-xs text-ink/40">
                Nenhuma etapa. Ex: fundação, alvenaria, elétrica, acabamento.
              </p>
            )}
            <div className="space-y-2">
              {form.stages.map((st, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={st.name}
                    onChange={(e) => updateStage(i, { name: e.target.value })}
                    placeholder="Etapa"
                    className="h-9 min-w-[120px] flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={st.value}
                    onChange={(e) => updateStage(i, { value: e.target.value })}
                    placeholder="Valor"
                    title="Valor da etapa"
                    className="h-9 w-24 rounded-lg border border-ink/15 bg-white px-2 text-right text-sm outline-none focus:border-teal-500"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={st.progress}
                      onChange={(e) =>
                        updateStage(i, {
                          progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      title="Avanço (%)"
                      className="h-9 w-16 rounded-lg border border-ink/15 bg-white px-2 text-right text-sm outline-none focus:border-teal-500"
                    />
                    <span className="text-xs text-ink/40">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStage(i)}
                    className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                    aria-label="Remover etapa"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {form.stages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-ink/60">
                  Orçado:{" "}
                  <strong className="text-ink">{formatPrice(budget)}</strong>
                </span>
                <span className="text-ink/60">
                  Executado:{" "}
                  <strong className="text-teal-600 dark:text-teal-100">
                    {formatPrice(executed)} ({pctBudget}%)
                  </strong>
                </span>
                <span className="text-ink/60">
                  Faturado:{" "}
                  <strong className="text-ink">{formatPrice(billed)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Medicoes */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <span className="mb-2 block text-sm font-medium text-ink/70">
              Medições (boletins)
            </span>
            {form.measurements.length > 0 && (
              <div className="mb-3 space-y-1">
                {form.measurements.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm"
                  >
                    <span className="text-ink/70">
                      #{i + 1} · {fmtDate(m.date)}
                      {m.note ? ` · ${m.note}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <strong className="text-teal-600 dark:text-teal-100">
                        {formatPrice(m.amount)}
                      </strong>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.postedToCash
                            ? "bg-teal-500/10 text-teal-600 dark:text-teal-100"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                        }`}
                      >
                        {m.postedToCash ? "no caixa" : "pendente"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="block min-w-[140px] flex-1">
                <span className="mb-1 block text-xs font-medium text-ink/60">
                  Observação (opcional)
                </span>
                <input
                  value={measureNote}
                  onChange={(e) => setMeasureNote(e.target.value)}
                  placeholder="Ex: 2ª medição"
                  className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block w-32">
                <span className="mb-1 block text-xs font-medium text-ink/60">
                  Valor (opcional)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={measureAmount}
                  onChange={(e) => setMeasureAmount(e.target.value)}
                  placeholder={formatPrice(aMedir)}
                  className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 text-right text-sm outline-none focus:border-teal-500"
                />
              </label>
              <button
                type="button"
                onClick={registrarMedicao}
                disabled={measuring || saving}
                className="h-10 rounded-lg bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {measuring ? "..." : "Registrar medição"}
              </button>
            </div>
            <p className="mt-2 text-xs text-ink/40">
              Sem valor, mede o avanço novo:{" "}
              <strong>{formatPrice(aMedir)}</strong> (executado − faturado). A
              medição entra no caixa (se houver caixa aberto).
            </p>
          </div>

          {/* Agenda */}
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
            <span className="mb-2 block text-sm font-semibold text-ink/80">
              Diárias na agenda (dias de obra)
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={lbl}>Serviço da diária</span>
                <select
                  value={form.service}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, service: e.target.value, time: "" }))
                  }
                  className={input}
                >
                  <option value="">Selecione...</option>
                  {services.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                {services.length === 0 && (
                  <span className="mt-1 block text-xs text-ink/40">
                    Cadastre um serviço na aba Serviços.
                  </span>
                )}
              </label>
              {hasTeam && (
                <label className="block">
                  <span className={lbl}>Profissional</span>
                  <select
                    value={form.professional}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        professional: e.target.value,
                        time: "",
                      }))
                    }
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
              <label className="block">
                <span className={lbl}>Frequência</span>
                <select
                  value={form.frequency}
                  onChange={(e) =>
                    set("frequency", e.target.value as ProjectFrequency)
                  }
                  className={input}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={lbl}>1º dia — data</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      startDate: e.target.value,
                      time: "",
                    }))
                  }
                  className={input}
                />
              </label>
              <label className="block">
                <span className={lbl}>Horário livre</span>
                <FreeSlotSelect
                  serviceId={form.service}
                  date={form.startDate}
                  professionalId={form.professional || null}
                  value={form.time}
                  onChange={(v) => set("time", v)}
                  className={input}
                />
              </label>
              <label className="block">
                <span className={lbl}>Nº de diárias</span>
                <input
                  type="number"
                  min="1"
                  max="53"
                  value={form.visitsCount}
                  onChange={(e) =>
                    set("visitsCount", Math.max(1, Number(e.target.value) || 1))
                  }
                  className={input}
                />
              </label>
            </div>
            <div className="mt-3">
              {scheduled ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-600 dark:text-teal-100">
                    Diárias agendadas na agenda
                  </span>
                  <button
                    type="button"
                    onClick={unscheduleNow}
                    disabled={scheduling}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {scheduling ? "..." : "Cancelar diárias"}
                  </button>
                </div>
              ) : form.frequency === "personalizada" ? (
                <p className="text-xs text-ink/50">
                  Frequência personalizada não gera diárias automáticas.
                </p>
              ) : canSchedule() ? (
                <p className="text-sm font-medium text-teal-600 dark:text-teal-100">
                  Ao salvar, {form.visitsCount} diária(s) serão geradas na agenda.
                </p>
              ) : (
                <p className="text-xs text-ink/50">
                  Preencha cliente, serviço, data e horário para gerar as diárias
                  ao salvar.
                </p>
              )}
            </div>
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

          {msg && (
            <p className="rounded-lg bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-600 dark:text-teal-100">
              {msg}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || scheduling}
              className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving || scheduling
                ? "Salvando..."
                : !form.seriesId && canSchedule()
                ? "Salvar e agendar"
                : "Salvar"}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="h-11 rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
            >
              Fechar
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
          {projects.length} obra{projects.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={startNew}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Nova obra
        </button>
      </div>

      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
          Nenhuma obra ainda. Crie a primeira.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const m = statusMeta(p.status);
            const b = (p.stages || []).reduce((s, e) => s + (e.value || 0), 0);
            const ex = (p.stages || []).reduce(
              (s, e) => s + (e.value || 0) * (Math.min(100, Math.max(0, e.progress || 0)) / 100),
              0
            );
            const pct = b > 0 ? Math.round((ex / b) * 100) : 0;
            return (
              <button
                key={p._id}
                onClick={() => startEdit(p)}
                className="rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink/40">
                      Obra #{p.number}
                    </p>
                    <h4 className="truncate font-display font-bold text-ink">
                      {p.title || p.clientName || "Sem título"}
                    </h4>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}
                  >
                    {m.label}
                  </span>
                </div>
                {(p.clientName || p.location) && (
                  <p className="mt-1 truncate text-sm text-ink/60">
                    {[p.clientName, p.location].filter(Boolean).join(" · ")}
                  </p>
                )}
                {b > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-ink/50">
                      <span>{formatPrice(b)}</span>
                      <span className="flex items-center gap-2">
                        {p.seriesId && (
                          <span className="text-teal-600 dark:text-teal-100">
                            na agenda
                          </span>
                        )}
                        <span>{pct}% executado</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(p._id);
                          }}
                          className="font-medium text-red-500 hover:underline"
                        >
                          Remover
                        </span>
                      </span>
                    </div>
                  </div>
                )}
                {b === 0 && (
                  <div className="mt-2 flex justify-end">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(p._id);
                      }}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Remover
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
