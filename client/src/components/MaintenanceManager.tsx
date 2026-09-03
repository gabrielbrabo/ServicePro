import { useEffect, useState } from "react";
import {
  maintenancePlanApi,
  MaintenancePlan,
  MaintenanceFrequency,
  MaintenanceTask,
} from "../api/maintenancePlan";
import { catalogApi, Service } from "../api/catalog";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import { professionalApi, Professional } from "../api/professional";
import { FreeSlotSelect } from "./FreeSlotSelect";

// Aba "Manutenção" (extra da categoria jardinagem-paisagismo, modulo
// "manutencao"): contratos de manutencao recorrente por cliente/local. Alem do
// escopo de servicos, o plano GERA VISITAS na agenda (bookings recorrentes
// confirmados) conforme a frequencia — igual as matriculas.

const input =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500";
const area =
  "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal-500";
const lbl = "mb-1 block text-sm font-medium text-ink/70";

const FREQUENCIES: { key: MaintenanceFrequency; label: string }[] = [
  { key: "semanal", label: "Semanal" },
  { key: "quinzenal", label: "Quinzenal" },
  { key: "mensal", label: "Mensal" },
  { key: "bimestral", label: "Bimestral" },
  { key: "trimestral", label: "Trimestral" },
  { key: "personalizada", label: "Personalizada" },
];
const freqLabel = (f: MaintenanceFrequency) =>
  FREQUENCIES.find((x) => x.key === f)?.label || f;

// meses/semanas a somar por frequencia
function addByFrequency(base: Date, freq: MaintenanceFrequency, i: number): Date {
  const d = new Date(base);
  if (freq === "semanal") d.setDate(d.getDate() + 7 * i);
  else if (freq === "quinzenal") d.setDate(d.getDate() + 14 * i);
  else if (freq === "mensal") d.setMonth(d.getMonth() + i);
  else if (freq === "bimestral") d.setMonth(d.getMonth() + 2 * i);
  else if (freq === "trimestral") d.setMonth(d.getMonth() + 3 * i);
  return d;
}

const emptyForm = () => ({
  client: "" as string,
  clientName: "",
  clientPhone: "",
  location: "",
  frequency: "mensal" as MaintenanceFrequency,
  frequencyNote: "",
  active: true,
  service: "" as string,
  professional: "" as string,
  startDate: "",
  time: "08:00",
  visitsCount: 4,
  seriesId: null as string | null,
  tasks: [] as MaintenanceTask[],
  notes: "",
});
type FormState = ReturnType<typeof emptyForm>;

export function MaintenanceManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<EstablishmentClient[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState("");
  const [scheduleMsg, setScheduleMsg] = useState("");

  const hasTeam = pros.length > 0;

  const load = () => {
    setLoading(true);
    Promise.all([
      maintenancePlanApi.list(establishmentId),
      catalogApi.byEstablishment(establishmentId).catch(() => []),
      recordApi.clients(establishmentId).catch(() => []),
      professionalApi.list(establishmentId).catch(() => []),
    ])
      .then(([pl, svcs, cls, prs]) => {
        setPlans(pl);
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
    setScheduleMsg("");
  };
  const startEdit = (p: MaintenancePlan) => {
    setForm({
      client: p.client || "",
      clientName: p.clientName,
      clientPhone: p.clientPhone,
      location: p.location,
      frequency: p.frequency,
      frequencyNote: p.frequencyNote,
      active: p.active,
      service: p.service || "",
      professional: p.professional || "",
      startDate: p.startDate,
      time: p.time || "08:00",
      visitsCount: p.visitsCount || 4,
      seriesId: p.seriesId,
      tasks: p.tasks || [],
      notes: p.notes,
    });
    setEditing(p._id);
    setError("");
    setScheduleMsg("");
  };
  const cancel = () => {
    setEditing(null);
    setError("");
    setScheduleMsg("");
  };

  const pickClient = (id: string) => {
    const c = clients.find((x) => x._id === id);
    setForm((f) => ({ ...f, client: id, clientName: c ? c.name : f.clientName }));
  };

  // ---- escopo (tarefas) ----
  const addTask = () => set("tasks", [...form.tasks, { name: "" }]);
  const updateTask = (i: number, name: string) =>
    set(
      "tasks",
      form.tasks.map((t, idx) => (idx === i ? { name } : t))
    );
  const removeTask = (i: number) =>
    set(
      "tasks",
      form.tasks.filter((_, idx) => idx !== i)
    );

  const payloadFromForm = () => ({
    client: form.client || null,
    clientName: form.clientName.trim(),
    clientPhone: form.clientPhone.trim(),
    location: form.location.trim(),
    frequency: form.frequency,
    frequencyNote: form.frequencyNote.trim(),
    active: form.active,
    service: form.service || null,
    professional: form.professional || null,
    startDate: form.startDate,
    time: form.time,
    visitsCount: form.visitsCount,
    tasks: form.tasks.map((t) => ({ name: t.name.trim() })).filter((t) => t.name),
    notes: form.notes.trim(),
  });

  // salva (create/update) sem fechar o editor; devolve o plano salvo
  const persist = async (): Promise<MaintenancePlan | null> => {
    if (!form.clientName.trim() && !form.client) {
      setError("Escolha um cliente.");
      return null;
    }
    setSaving(true);
    setError("");
    try {
      const payload = payloadFromForm();
      let saved: MaintenancePlan;
      if (editing === "new") {
        saved = await maintenancePlanApi.create(establishmentId, payload);
        setPlans((list) => [saved, ...list]);
        setEditing(saved._id);
      } else if (editing) {
        saved = await maintenancePlanApi.update(establishmentId, editing, payload);
        setPlans((list) => list.map((p) => (p._id === editing ? saved : p)));
      } else {
        return null;
      }
      set("seriesId", saved.seriesId);
      return saved;
    } catch {
      setError("Não foi possível salvar.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // pronto para agendar = todos os campos da recorrencia preenchidos
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

  const doSchedule = async (planId: string): Promise<void> => {
    const slots = computeSlots();
    if (slots.length === 0) return;
    setScheduling(true);
    setScheduleMsg("");
    try {
      const r = await maintenancePlanApi.schedule(establishmentId, planId, slots);
      setPlans((list) => list.map((p) => (p._id === planId ? r.plan : p)));
      set("seriesId", r.seriesId);
      setScheduleMsg(
        `${r.createdCount} visita(s) agendada(s) na agenda` +
          (r.skippedCount
            ? ` · ${r.skippedCount} pulada(s) por horário ocupado/indisponível`
            : "")
      );
    } catch {
      setError(
        "Plano salvo, mas não foi possível gerar as visitas. Verifique o serviço, o profissional e a disponibilidade."
      );
    } finally {
      setScheduling(false);
    }
  };

  // Salvar: persiste o plano e, se a recorrencia estiver completa e ainda nao
  // houver serie, JA gera as visitas na agenda. Se faltar campo, so salva.
  const save = async () => {
    const p = await persist();
    if (!p) return;
    if (!p.seriesId && canSchedule()) {
      await doSchedule(p._id); // mantem o editor aberto p/ mostrar o resultado
      return;
    }
    setEditing(null);
  };

  const unscheduleNow = async () => {
    if (!editing || editing === "new") return;
    setScheduling(true);
    setError("");
    setScheduleMsg("");
    try {
      const updated = await maintenancePlanApi.unschedule(
        establishmentId,
        editing
      );
      setPlans((list) => list.map((p) => (p._id === editing ? updated : p)));
      set("seriesId", null);
      setScheduleMsg("Visitas futuras canceladas na agenda.");
    } catch {
      setError("Não foi possível cancelar as visitas.");
    } finally {
      setScheduling(false);
    }
  };

  const remove = async (id: string) => {
    await maintenancePlanApi.remove(establishmentId, id);
    setPlans((list) => list.filter((p) => p._id !== id));
  };

  // ---- editor ----
  if (editing) {
    const scheduled = !!form.seriesId;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">
            {editing === "new" ? "Novo plano de manutenção" : "Editar plano"}
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
                placeholder="Ex: Condomínio Jardins, casa 12"
                className={input}
              />
            </label>
          </div>

          {/* Escopo do plano */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink/70">
                Serviços do plano
              </span>
              <button
                type="button"
                onClick={addTask}
                className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
              >
                + Serviço
              </button>
            </div>
            {form.tasks.length === 0 && (
              <p className="text-xs text-ink/40">
                Nenhum serviço. Ex: cortar grama, podar, adubar, limpar
                canteiros.
              </p>
            )}
            <div className="space-y-2">
              {form.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={t.name}
                    onChange={(e) => updateTask(i, e.target.value)}
                    placeholder="Serviço recorrente"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeTask(i)}
                    className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                    aria-label="Remover serviço"
                  >
                    ✕
                  </button>
                </div>
              ))}
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

          {/* Agendamento na agenda */}
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
            <span className="mb-2 block text-sm font-semibold text-ink/80">
              Visitas na agenda
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={lbl}>Serviço da visita</span>
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
                    set("frequency", e.target.value as MaintenanceFrequency)
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
                <span className={lbl}>Situação</span>
                <button
                  type="button"
                  onClick={() => set("active", !form.active)}
                  className={`h-11 w-full rounded-xl px-3 text-sm font-semibold transition ${
                    form.active
                      ? "bg-teal-500/15 text-teal-600 dark:text-teal-100"
                      : "bg-ink/10 text-ink/50"
                  }`}
                >
                  {form.active ? "Ativo" : "Pausado"}
                </button>
              </label>
              <label className="block">
                <span className={lbl}>1ª visita — data</span>
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
                <span className={lbl}>Nº de visitas</span>
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

            {form.frequency === "personalizada" && (
              <div className="mt-3">
                <label className="block">
                  <span className={lbl}>Detalhe da frequência</span>
                  <input
                    value={form.frequencyNote}
                    onChange={(e) => set("frequencyNote", e.target.value)}
                    placeholder="Ex: toda 2ª e 5ª feira"
                    className={input}
                  />
                </label>
                <p className="mt-1 text-xs text-ink/40">
                  A frequência personalizada não gera visitas automáticas na
                  agenda.
                </p>
              </div>
            )}

            <div className="mt-3">
              {scheduled ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-600 dark:text-teal-100">
                    Visitas agendadas na agenda
                  </span>
                  <button
                    type="button"
                    onClick={unscheduleNow}
                    disabled={scheduling}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {scheduling ? "..." : "Cancelar visitas"}
                  </button>
                </div>
              ) : form.frequency === "personalizada" ? (
                <p className="text-xs text-ink/50">
                  Frequência personalizada não gera visitas automáticas — o
                  plano é salvo sem agendar.
                </p>
              ) : canSchedule() ? (
                <p className="text-sm font-medium text-teal-600 dark:text-teal-100">
                  Ao salvar, {form.visitsCount} visita(s) serão geradas na
                  agenda.
                </p>
              ) : (
                <p className="text-xs text-ink/50">
                  Preencha cliente, serviço, data e horário para gerar as
                  visitas ao salvar. Sem isso, o plano é salvo sem agendar.
                </p>
              )}
              {scheduleMsg && (
                <p className="mt-2 text-sm font-medium text-teal-600 dark:text-teal-100">
                  {scheduleMsg}
                </p>
              )}
            </div>
          </div>

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
          {plans.length} plano{plans.length !== 1 ? "s" : ""} de manutenção
        </p>
        <button
          onClick={startNew}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Novo plano
        </button>
      </div>

      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
          Nenhum plano de manutenção ainda. Crie o primeiro.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <button
              key={p._id}
              onClick={() => startEdit(p)}
              className="rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate font-display font-bold text-ink">
                    {p.clientName || "Sem nome"}
                  </h4>
                  {p.location && (
                    <p className="truncate text-sm text-ink/60">{p.location}</p>
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
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    p.active
                      ? "bg-teal-500/10 text-teal-600 dark:text-teal-100"
                      : "bg-ink/10 text-ink/50"
                  }`}
                >
                  {p.active ? "Ativo" : "Pausado"}
                </span>
                <span className="rounded-full bg-ink/10 px-2 py-0.5 font-medium text-ink/60">
                  {freqLabel(p.frequency)}
                </span>
                {p.seriesId && (
                  <span className="rounded-full bg-teal-500/10 px-2 py-0.5 font-medium text-teal-600 dark:text-teal-100">
                    Na agenda
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
