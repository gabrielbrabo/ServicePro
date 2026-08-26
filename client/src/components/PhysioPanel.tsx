import { useEffect, useState } from "react";
import {
  physioApi,
  SessionPackage,
  PhysioAssessment,
  AssessmentPayload,
} from "../api/physio";

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

// cor da escala de dor EVA (0-10)
function evaColor(n: number): string {
  if (n <= 3) return "bg-emerald-500";
  if (n <= 6) return "bg-amber-500";
  return "bg-red-500";
}

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function PhysioPanel({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [view, setView] = useState<"pacotes" | "avaliacoes">("pacotes");

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-sand/60 p-1">
        {(
          [
            ["pacotes", "Pacotes de sessões"],
            ["avaliacoes", "Avaliações"],
          ] as ["pacotes" | "avaliacoes", string][]
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

      {view === "pacotes" ? (
        <PackagesSection
          establishmentId={establishmentId}
          clientId={clientId}
        />
      ) : (
        <AssessmentsSection
          establishmentId={establishmentId}
          clientId={clientId}
        />
      )}
    </div>
  );
}

// ============ PACOTES DE SESSOES ============
function PackagesSection({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [items, setItems] = useState<SessionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("10");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    physioApi
      .listPackages(establishmentId, clientId)
      .then(setItems)
      .catch(() => setError("Não foi possível carregar os pacotes."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const replace = (pkg: SessionPackage) =>
    setItems((list) => list.map((x) => (x._id === pkg._id ? pkg : x)));

  const create = async () => {
    const t = Math.max(1, Math.floor(Number(total) || 0));
    if (!t) {
      setError("Informe o total de sessões.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const pkg = await physioApi.createPackage(establishmentId, clientId, {
        title: title.trim() || undefined,
        totalSessions: t,
        price: Number(price) || 0,
        notes: notes.trim() || undefined,
      });
      setItems((list) => [pkg, ...list]);
      setTitle("");
      setTotal("10");
      setPrice("");
      setNotes("");
      setShowForm(false);
    } catch {
      setError("Não foi possível criar o pacote.");
    } finally {
      setSaving(false);
    }
  };

  const registerSession = async (pkg: SessionPackage) => {
    try {
      const updated = await physioApi.addUse(establishmentId, clientId, pkg._id);
      replace(updated);
    } catch {
      setError("Não foi possível registrar a sessão.");
    }
  };

  const estornar = async (pkg: SessionPackage, useId: string) => {
    try {
      const updated = await physioApi.removeUse(
        establishmentId,
        clientId,
        pkg._id,
        useId
      );
      replace(updated);
    } catch {
      setError("Não foi possível estornar a sessão.");
    }
  };

  const remove = async (pkg: SessionPackage) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== pkg._id));
    try {
      await physioApi.removePackage(establishmentId, clientId, pkg._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover o pacote.");
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Controle o saldo de sessões compradas.
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            + Novo pacote
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h4 className="font-display font-bold text-ink">Novo pacote</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Título
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Pacote de fisioterapia — lombar"
                className="h-10 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Total de sessões
              </span>
              <input
                type="number"
                min="1"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Valor do pacote (R$, opcional)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Observações (opcional)
              </span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={create}
              disabled={saving}
              className="h-10 rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Criar pacote"}
            </button>
            <button
              onClick={() => setShowForm(false)}
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
          Carregando pacotes...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum pacote ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((pkg) => {
            const used = pkg.uses.length;
            const remaining = Math.max(0, pkg.totalSessions - used);
            const pct = Math.min(100, (used / pkg.totalSessions) * 100);
            const full = used >= pkg.totalSessions;
            return (
              <div
                key={pkg._id}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">
                      {pkg.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {STATUS_LABEL[pkg.status] || pkg.status}
                      {pkg.price > 0 ? ` · R$ ${pkg.price.toFixed(2)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(pkg)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>

                {/* saldo */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">
                      {used} / {pkg.totalSessions} sessões
                    </span>
                    <span className="text-ink/50">{remaining} restantes</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {pkg.notes && (
                  <p className="mt-2 text-sm text-ink/60">{pkg.notes}</p>
                )}

                <div className="mt-3">
                  <button
                    onClick={() => registerSession(pkg)}
                    disabled={full || pkg.status === "cancelado"}
                    className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-40"
                  >
                    {full ? "Pacote concluído" : "Registrar sessão"}
                  </button>
                </div>

                {/* sessoes usadas */}
                {used > 0 && (
                  <div className="mt-3 border-t border-ink/10 pt-3">
                    <p className="mb-2 text-xs font-semibold text-ink/50">
                      Sessões registradas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[...pkg.uses]
                        .sort(
                          (a, b) =>
                            new Date(a.date).getTime() -
                            new Date(b.date).getTime()
                        )
                        .map((u, i) => (
                          <span
                            key={u._id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-sand/60 px-2.5 py-1 text-xs text-ink/70"
                          >
                            {i + 1}ª · {fmtDate(u.date)}
                            <button
                              onClick={() => estornar(pkg, u._id)}
                              className="text-ink/40 hover:text-red-600"
                              aria-label="Estornar sessão"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ AVALIACOES FISIOTERAPEUTICAS ============
const emptyAssessment = () => ({
  date: toDateInput(new Date()),
  painEva: "" as string, // "" = nao avaliado
  mainComplaint: "",
  rangeOfMotion: "",
  muscleStrength: "",
  observations: "",
  goals: "",
});

function AssessmentsSection({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [items, setItems] = useState<PhysioAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAssessment());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    physioApi
      .listAssessments(establishmentId, clientId)
      .then(setItems)
      .catch(() => setError("Não foi possível carregar as avaliações."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const setField = (k: keyof ReturnType<typeof emptyAssessment>, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const authorName = (a: PhysioAssessment["author"]): string =>
    a && typeof a === "object" ? a.name : "Profissional";

  const openNew = () => {
    setEditingId(null);
    setForm(emptyAssessment());
    setShowForm(true);
    setError(null);
  };

  const openEdit = (a: PhysioAssessment) => {
    setEditingId(a._id);
    setForm({
      date: toDateInput(new Date(a.date)),
      painEva: a.painEva === null ? "" : String(a.painEva),
      mainComplaint: a.mainComplaint || "",
      rangeOfMotion: a.rangeOfMotion || "",
      muscleStrength: a.muscleStrength || "",
      observations: a.observations || "",
      goals: a.goals || "",
    });
    setShowForm(true);
    setError(null);
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyAssessment());
  };

  const hasContent =
    form.mainComplaint.trim() ||
    form.rangeOfMotion.trim() ||
    form.muscleStrength.trim() ||
    form.observations.trim() ||
    form.goals.trim() ||
    form.painEva !== "";

  const submit = async () => {
    if (!hasContent) {
      setError("Preencha ao menos um campo da avaliação.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: AssessmentPayload = {
      date: form.date || undefined,
      painEva: form.painEva === "" ? null : Number(form.painEva),
      mainComplaint: form.mainComplaint.trim(),
      rangeOfMotion: form.rangeOfMotion.trim(),
      muscleStrength: form.muscleStrength.trim(),
      observations: form.observations.trim(),
      goals: form.goals.trim(),
    };
    try {
      if (editingId) {
        const updated = await physioApi.updateAssessment(
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
        const created = await physioApi.createAssessment(
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

  const remove = async (a: PhysioAssessment) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== a._id));
    try {
      await physioApi.removeAssessment(establishmentId, clientId, a._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover a avaliação.");
    }
  };

  const fields: {
    key: "mainComplaint" | "rangeOfMotion" | "muscleStrength" | "observations" | "goals";
    label: string;
    hint: string;
  }[] = [
    { key: "mainComplaint", label: "Queixa principal", hint: "Motivo da avaliação, história" },
    { key: "rangeOfMotion", label: "Amplitude de movimento (ADM / goniometria)", hint: "Ex: flexão de joelho 0-110°" },
    { key: "muscleStrength", label: "Força muscular", hint: "Ex: quadríceps grau 4/5" },
    { key: "observations", label: "Inspeção / testes / postura", hint: "Palpação, testes especiais, postura" },
    { key: "goals", label: "Objetivos do tratamento", hint: "Metas funcionais" },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Avaliação física com escala de dor (EVA).
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
        <div className="mb-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h4 className="font-display font-bold text-ink">
            {editingId ? "Editar avaliação" : "Nova avaliação"}
          </h4>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Data
              </span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                className="h-10 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Dor — EVA (0 a 10)
              </span>
              <select
                value={form.painEva}
                onChange={(e) => setField("painEva", e.target.value)}
                className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
              >
                <option value="">Não avaliado</option>
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={String(i)}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 space-y-3">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-medium text-ink/60">
                  {f.label}{" "}
                  <span className="text-ink/35">— {f.hint}</span>
                </span>
                <textarea
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={submit}
              disabled={saving || !hasContent}
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
          {items.map((a) => (
            <div
              key={a._id}
              className="rounded-2xl border border-ink/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{fmtDate(a.date)}</p>
                  <p className="mt-0.5 text-xs text-ink/50">{authorName(a.author)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.painEva !== null && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white ${evaColor(
                        a.painEva
                      )}`}
                      title="Escala de dor (EVA)"
                    >
                      Dor {a.painEva}/10
                    </span>
                  )}
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

              <div className="mt-3 space-y-2">
                {fields.map((f) =>
                  a[f.key] ? (
                    <div key={f.key}>
                      <p className="text-xs font-semibold text-ink/50">
                        {f.label}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-ink/80">
                        {a[f.key]}
                      </p>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
