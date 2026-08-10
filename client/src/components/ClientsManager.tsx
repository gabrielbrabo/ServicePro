import { useEffect, useState, useCallback } from "react";
import {
  recordApi,
  EstablishmentClient,
  MedicalRecord,
  RecordNote,
  ClientHistoryItem,
} from "../api/medicalRecord";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "Pix",
  outro: "Outro",
};

const authorName = (a: RecordNote["author"]): string =>
  typeof a === "object" && a ? a.name : "";

export function ClientsManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [clients, setClients] = useState<EstablishmentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EstablishmentClient | null>(null);

  const loadClients = useCallback(() => {
    setLoading(true);
    recordApi
      .clients(establishmentId)
      .then(setClients)
      .catch(() => setError("Não foi possível carregar os clientes."))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  useEffect(loadClients, [loadClients]);

  if (selected) {
    return (
      <RecordPanel
        establishmentId={establishmentId}
        client={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando clientes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 p-12 text-center text-ink/50">
        Nenhum cliente ainda. Clientes aparecem aqui depois de agendarem.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-ink/60">
        {clients.length} cliente{clients.length !== 1 ? "s" : ""}. Clique para
        ver o prontuário e o histórico.
      </p>
      <div className="space-y-2">
        {clients.map((c) => (
          <button
            key={c._id}
            onClick={() => setSelected(c)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              {c.avatar ? (
                <img
                  src={c.avatar}
                  alt={c.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-600">
                  {c.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <p className="font-medium text-ink">{c.name}</p>
                <p className="text-xs text-ink/50">
                  {c.bookingCount} agendamento{c.bookingCount !== 1 ? "s" : ""} ·
                  último {fmtDate(c.lastBooking)}
                </p>
              </div>
            </div>
            <span className="text-sm font-medium text-teal-600">
              Ver ficha →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- ficha do cliente: histórico + prontuário ----
function RecordPanel({
  establishmentId,
  client,
  onBack,
}: {
  establishmentId: string;
  client: EstablishmentClient;
  onBack: () => void;
}) {
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [history, setHistory] = useState<ClientHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [observations, setObservations] = useState("");
  const [savingFields, setSavingFields] = useState(false);
  const [savedFields, setSavedFields] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    recordApi
      .get(establishmentId, client._id)
      .then((r) => {
        setRecord(r);
        setAllergies(r.allergies || "");
        setMedications(r.medications || "");
        setObservations(r.observations || "");
      })
      .catch(() => setError("Não foi possível carregar o prontuário."))
      .finally(() => setLoading(false));

    setLoadingHistory(true);
    recordApi
      .history(establishmentId, client._id)
      .then(setHistory)
      .catch(() => {
        /* histórico é secundário */
      })
      .finally(() => setLoadingHistory(false));
  }, [establishmentId, client._id]);

  useEffect(load, [load]);

  const saveFields = async () => {
    setSavingFields(true);
    setSavedFields(false);
    setError(null);
    try {
      const updated = await recordApi.update(establishmentId, client._id, {
        allergies,
        medications,
        observations,
      });
      setRecord(updated);
      setSavedFields(true);
      setTimeout(() => setSavedFields(false), 2500);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSavingFields(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    setError(null);
    try {
      const updated = await recordApi.addNote(
        establishmentId,
        client._id,
        noteText.trim()
      );
      setRecord(updated);
      setNoteText("");
    } catch {
      setError("Não foi possível adicionar a anotação.");
    } finally {
      setAddingNote(false);
    }
  };

  const removeNote = async (noteId: string) => {
    const prev = record;
    if (record) {
      setRecord({
        ...record,
        notes: record.notes.filter((n) => n._id !== noteId),
      });
    }
    try {
      const updated = await recordApi.deleteNote(
        establishmentId,
        client._id,
        noteId
      );
      setRecord(updated);
    } catch {
      setRecord(prev);
      setError("Não foi possível remover a anotação.");
    }
  };

  const notes = record
    ? [...record.notes].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    : [];

  const totalSpent = history.reduce((sum, h) => sum + h.amount, 0);

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-ink/50 transition hover:bg-sand"
          aria-label="Voltar"
        >
          ←
        </button>
        <div className="flex items-center gap-3">
          {client.avatar ? (
            <img
              src={client.avatar}
              alt={client.name}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-500/10 text-lg font-bold text-teal-600">
              {client.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {client.name}
            </h2>
            <p className="text-sm text-ink/50">Ficha do cliente</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-3 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando prontuário...
          </div>
        ) : (
          <>
            {/* Campos fixos do prontuário */}
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h3 className="font-display text-lg font-bold text-ink">
                Prontuário
              </h3>

              <label className="mt-4 block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Alergias
                </span>
                <textarea
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  rows={2}
                  placeholder="Ex: alergia a dipirona, látex..."
                  className="w-full rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Medicamentos
                </span>
                <textarea
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  rows={2}
                  placeholder="Medicamentos em uso contínuo..."
                  className="w-full rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Observações
                </span>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                  placeholder="Observações gerais sobre o cliente..."
                  className="w-full rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={saveFields}
                  disabled={savingFields}
                  className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
                >
                  {savingFields ? "Salvando..." : "Salvar informações"}
                </button>
                {savedFields && (
                  <span className="text-sm font-medium text-teal-600">
                    Salvo ✓
                  </span>
                )}
              </div>
            </div>

            {/* Anotações datadas */}
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h3 className="font-display text-lg font-bold text-ink">
                Anotações
              </h3>
              <p className="mt-1 text-sm text-ink/60">
                Registre a evolução do atendimento. Cada anotação fica com data
                e autor.
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNote();
                    }
                  }}
                  placeholder="Nova anotação..."
                  className="h-11 flex-1 rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
                <button
                  onClick={addNote}
                  disabled={addingNote || !noteText.trim()}
                  className="h-11 rounded-xl bg-teal-500 px-5 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
                >
                  {addingNote ? "..." : "Adicionar"}
                </button>
              </div>

              <div className="mt-4">
                {notes.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
                    Nenhuma anotação ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div
                        key={n._id}
                        className="rounded-xl border border-ink/10 bg-sand/40 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-ink">{n.text}</p>
                          <button
                            onClick={() => removeNote(n._id)}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
                          >
                            Remover
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs text-ink/50">
                          {fmtDateTime(n.createdAt)}
                          {authorName(n.author)
                            ? ` · ${authorName(n.author)}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {/* Histórico de atendimentos */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">
                Histórico de atendimentos
              </h3>
              <p className="text-sm text-ink/60">
                Tudo que já foi feito neste estabelecimento.
              </p>
            </div>
            {history.length > 0 && (
              <p className="text-sm text-ink/60">
                {history.length} atendimento{history.length !== 1 ? "s" : ""} ·
                total{" "}
                <strong className="text-teal-600">{BRL(totalSpent)}</strong>
              </p>
            )}
          </div>

          <div className="mt-4">
            {loadingHistory ? (
              <p className="text-ink/50">Carregando histórico...</p>
            ) : history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
                Nenhum atendimento concluído ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-sand/40 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/10 text-sm text-teal-600">
                        ✓
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {h.serviceTitle}
                        </p>
                        <p className="text-xs text-ink/50">
                          {fmtDate(h.scheduledAt)}
                          {h.professionalName ? ` · ${h.professionalName}` : ""}
                          {h.method ? ` · ${METHOD_LABEL[h.method] ?? h.method}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-teal-600">
                      {BRL(h.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}