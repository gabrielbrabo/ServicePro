import { useEffect, useMemo, useState } from "react";
import {
  evolutionApi,
  Evolution,
  EvolutionPayload,
  EvolutionCid,
} from "../api/evolution";
import { recordApi, RecordNote, ClientHistoryItem } from "../api/medicalRecord";
import { searchCid } from "../lib/cid10";

// data local no formato YYYY-MM-DD (para <input type="date">), sem o desvio de
// fuso que o toISOString() causa perto da meia-noite.
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

// os quatro campos do SOAP, com rotulo e dica
const SOAP_FIELDS: {
  key: "subjective" | "objective" | "assessment" | "plan";
  letter: string;
  label: string;
  hint: string;
}[] = [
  {
    key: "subjective",
    letter: "S",
    label: "Subjetivo",
    hint: "Queixa e relato do paciente",
  },
  {
    key: "objective",
    letter: "O",
    label: "Objetivo",
    hint: "Exame físico, medidas, observações",
  },
  {
    key: "assessment",
    letter: "A",
    label: "Avaliação",
    hint: "Hipótese diagnóstica / evolução do quadro",
  },
  {
    key: "plan",
    letter: "P",
    label: "Plano / Conduta",
    hint: "Conduta, prescrição, próximos passos",
  },
];

const emptyForm = (): {
  date: string;
  bookingId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
} => ({
  date: toDateInput(new Date()),
  bookingId: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
});

// Evolucao clinica SOAP: registro por atendimento. Serve clinica, fisio e
// odonto. Substitui a antiga "evolucao" em texto livre (mantida abaixo, so
// leitura, para nao perder o que ja foi anotado).
export function Evolutions({
  establishmentId,
  clientId,
  legacyNotes = [],
}: {
  establishmentId: string;
  clientId: string;
  legacyNotes?: RecordNote[];
}) {
  const [items, setItems] = useState<Evolution[]>([]);
  const [history, setHistory] = useState<ClientHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [cids, setCids] = useState<EvolutionCid[]>([]);
  const [cidQuery, setCidQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    evolutionApi
      .list(establishmentId, clientId)
      .then(setItems)
      .catch(() => setError("Não foi possível carregar as evoluções."))
      .finally(() => setLoading(false));
    // atendimentos concluidos: para vincular a evolucao a um atendimento
    recordApi
      .history(establishmentId, clientId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [establishmentId, clientId]);

  // mapa bookingId -> atendimento, para exibir o vinculo no card
  const historyById = useMemo(() => {
    const m = new Map<string, ClientHistoryItem>();
    history.forEach((h) => m.set(h._id, h));
    return m;
  }, [history]);

  const authorName = (a: Evolution["author"]): string => {
    if (a && typeof a === "object") return a.name;
    return "Profissional";
  };

  const setField = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setCids([]);
    setCidQuery("");
    setShowForm(true);
    setError(null);
  };

  const openEdit = (ev: Evolution) => {
    setEditingId(ev._id);
    setForm({
      date: toDateInput(new Date(ev.date)),
      bookingId: ev.booking || "",
      subjective: ev.subjective || "",
      objective: ev.objective || "",
      assessment: ev.assessment || "",
      plan: ev.plan || "",
    });
    setCids(ev.cids || []);
    setCidQuery("");
    setShowForm(true);
    setError(null);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setCids([]);
    setCidQuery("");
  };

  // adiciona um CID (dedupe por codigo)
  const addCid = (c: EvolutionCid) => {
    const code = c.code.trim().toUpperCase();
    if (!code) return;
    setCids((list) =>
      list.some((x) => x.code === code)
        ? list
        : [...list, { code, description: c.description || "" }]
    );
    setCidQuery("");
  };

  const removeCid = (code: string) =>
    setCids((list) => list.filter((x) => x.code !== code));

  // sugestoes do autocomplete, tirando os ja adicionados
  const cidSuggestions = cidQuery.trim()
    ? searchCid(cidQuery).filter((s) => !cids.some((c) => c.code === s.code))
    : [];

  const hasContent =
    form.subjective.trim() ||
    form.objective.trim() ||
    form.assessment.trim() ||
    form.plan.trim();

  const submit = async () => {
    if (!hasContent) {
      setError("Preencha ao menos um campo da evolução.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: EvolutionPayload = {
      subjective: form.subjective.trim(),
      objective: form.objective.trim(),
      assessment: form.assessment.trim(),
      plan: form.plan.trim(),
      date: form.date || undefined,
      bookingId: form.bookingId || null,
      cids,
    };
    try {
      if (editingId) {
        const updated = await evolutionApi.update(
          establishmentId,
          clientId,
          editingId,
          payload
        );
        setItems((list) =>
          list
            .map((x) => (x._id === editingId ? updated : x))
            .sort(
              (a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );
      } else {
        const created = await evolutionApi.create(
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
      cancelForm();
    } catch {
      setError("Não foi possível salvar a evolução.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ev: Evolution) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== ev._id));
    try {
      await evolutionApi.remove(establishmentId, clientId, ev._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover a evolução.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">Evolução</h3>
          <p className="text-sm text-ink/50">
            Registro clínico por atendimento, no formato SOAP.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openNew}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            + Nova evolução
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Formulario SOAP (criar/editar) */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-ink/10 bg-white p-5">
          <h4 className="font-display font-bold text-ink">
            {editingId ? "Editar evolução" : "Nova evolução"}
          </h4>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Data
              </span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>

            {history.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Atendimento (opcional)
                </span>
                <select
                  value={form.bookingId}
                  onChange={(e) => setField("bookingId", e.target.value)}
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                >
                  <option value="">Sem vínculo</option>
                  {history.map((h) => (
                    <option key={h._id} value={h._id}>
                      {fmtDate(h.completedAt || h.scheduledAt)} · {h.serviceTitle}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {SOAP_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 flex items-baseline gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-500/10 text-xs font-bold text-teal-600">
                    {f.letter}
                  </span>
                  <span className="text-sm font-medium text-ink/80">
                    {f.label}
                  </span>
                  <span className="text-xs text-ink/40">— {f.hint}</span>
                </span>
                <textarea
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
            ))}
          </div>

          {/* CID-10 (opcional) */}
          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              CID-10 (opcional)
            </span>

            {cids.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {cids.map((c) => (
                  <span
                    key={c.code}
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-700"
                    title={c.description}
                  >
                    <span className="font-bold">{c.code}</span>
                    {c.description ? (
                      <span className="max-w-[16rem] truncate text-teal-700/80">
                        {c.description}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeCid(c.code)}
                      className="ml-0.5 text-teal-700/70 hover:text-red-600"
                      aria-label={`Remover ${c.code}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                value={cidQuery}
                onChange={(e) => setCidQuery(e.target.value)}
                placeholder="Buscar por código ou descrição (ex: M54.5, lombar)"
                className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
              {cidQuery.trim() && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-ink/15 bg-white shadow-lg">
                  {cidSuggestions.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => addCid(s)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-sand"
                    >
                      <span className="font-bold text-teal-600">{s.code}</span>
                      <span className="text-ink/70">{s.description}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      addCid({
                        code: cidQuery.trim().toUpperCase(),
                        description: "",
                      })
                    }
                    className="flex w-full items-center gap-2 border-t border-ink/10 px-3 py-2 text-left text-sm text-ink/60 transition hover:bg-sand"
                  >
                    + Adicionar &quot;{cidQuery.trim().toUpperCase()}&quot; como
                    digitado
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={submit}
              disabled={saving || !hasContent}
              className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {saving
                ? "Salvando..."
                : editingId
                ? "Salvar alterações"
                : "Salvar evolução"}
            </button>
            <button
              onClick={cancelForm}
              className="h-11 rounded-xl border border-ink/15 px-5 text-sm font-medium text-ink/70 transition hover:bg-sand"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de evolucoes */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando evoluções...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhuma evolução registrada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((ev) => {
            const linked = ev.booking ? historyById.get(ev.booking) : undefined;
            return (
              <div
                key={ev._id}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{fmtDate(ev.date)}</p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {authorName(ev.author)}
                      {linked ? ` · ${linked.serviceTitle}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(ev)}
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-sand"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(ev)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {SOAP_FIELDS.map((f) =>
                    ev[f.key] ? (
                      <div key={f.key} className="flex gap-2">
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-teal-500/10 text-xs font-bold text-teal-600"
                          title={f.label}
                        >
                          {f.letter}
                        </span>
                        <p className="whitespace-pre-wrap text-sm text-ink/80">
                          {ev[f.key]}
                        </p>
                      </div>
                    ) : null
                  )}
                </div>

                {ev.cids && ev.cids.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ev.cids.map((c) => (
                      <span
                        key={c.code}
                        className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-sand/60 px-2 py-0.5 text-xs text-ink/70"
                        title={c.description}
                      >
                        <span className="font-bold text-teal-600">{c.code}</span>
                        {c.description ? (
                          <span className="max-w-[14rem] truncate">
                            {c.description}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Anotacoes antigas (formato livre), so leitura */}
      {legacyNotes.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-semibold text-ink/60">
            Anotações anteriores
          </h4>
          <p className="mb-3 text-xs text-ink/40">
            Registros no formato antigo (texto livre), mantidos apenas para
            consulta.
          </p>
          <div className="space-y-2">
            {[...legacyNotes]
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )
              .map((n) => (
                <div
                  key={n._id}
                  className="rounded-xl border border-ink/10 bg-sand/40 p-4"
                >
                  <p className="text-xs text-ink/50">
                    {fmtDateTime(n.createdAt)} ·{" "}
                    {typeof n.author === "object" ? n.author.name : "Profissional"}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink/80">
                    {n.text}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
