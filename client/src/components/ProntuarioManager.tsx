import { useEffect, useMemo, useState } from "react";
import {
  recordApi,
  MedicalRecord,
  EstablishmentClient,
  RecordNote,
  ClientHistoryItem,
} from "../api/medicalRecord";
import { Establishment } from "../api/establishment";
import { hasModule } from "../lib/segments";
import { TreatmentPlans } from "./TreatmentPlans";
import { PatientDocuments } from "./PatientDocuments";
import { Odontograma } from "./Odontograma";
import { Periograma } from "./Periograma";
import { Evolutions } from "./Evolutions";
import { PhysioPanel } from "./PhysioPanel";

// rotulo amigavel da forma de pagamento
function methodLabel(m: string): string {
  const map: Record<string, string> = {
    dinheiro: "Dinheiro",
    cartao: "Cartão",
    pix: "Pix",
    outro: "Outro",
  };
  return map[m] || m;
}

// Aba "Prontuário" (area Saude): lista pacientes -> ficha de anamnese (com
// alerta de alergia) + historico de evolucao (notas datadas).
export function ProntuarioManager({
  establishment,
}: {
  establishment: Establishment;
}) {
  const establishmentId = establishment._id;
  // sub-abas conforme os modulos liberados na area
  const canPlano = hasModule(
    establishment.segment,
    "plano_tratamento",
    establishment.category?.slug
  );
  const canDocs = hasModule(
    establishment.segment,
    "documentos",
    establishment.category?.slug
  );
  const canOdonto = hasModule(
    establishment.segment,
    "odontograma",
    establishment.category?.slug
  );
  const canFisio = hasModule(
    establishment.segment,
    "fisioterapia",
    establishment.category?.slug
  );

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
    return patients.filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, query]);

  if (selected) {
    return (
      <PatientRecord
        establishmentId={establishmentId}
        establishment={establishment}
        patient={selected}
        canPlano={canPlano}
        canDocs={canDocs}
        canOdonto={canOdonto}
        canFisio={canFisio}
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
              ? "Nenhum paciente ainda. O prontuário fica disponível para quem já teve atendimento aqui."
              : "Nenhum paciente encontrado com esse nome."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <button
                key={p._id}
                onClick={() => setSelected(p)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3 text-left transition hover:border-teal-500/40 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {p.avatar ? (
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-600">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-ink/50">
                      {p.bookingCount} atendimento
                      {p.bookingCount !== 1 ? "s" : ""}
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

// ---- Ficha de um paciente ----
function PatientRecord({
  establishmentId,
  establishment,
  patient,
  canPlano,
  canDocs,
  canOdonto,
  canFisio,
  onBack,
}: {
  establishmentId: string;
  establishment: Establishment;
  patient: EstablishmentClient;
  canPlano: boolean;
  canDocs: boolean;
  canOdonto: boolean;
  canFisio: boolean;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [observations, setObservations] = useState("");
  const [savedAllergies, setSavedAllergies] = useState("");
  const [savingAnamnese, setSavingAnamnese] = useState(false);

  const [notes, setNotes] = useState<RecordNote[]>([]);

  // sub-abas: ficha, evolucao (SOAP), linha do tempo (atendimentos), etc.
  const [view, setView] = useState<
    | "ficha"
    | "evolucao"
    | "timeline"
    | "plano"
    | "docs"
    | "odonto"
    | "perio"
    | "fisio"
  >("ficha");
  const [history, setHistory] = useState<ClientHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // carrega a linha do tempo so quando a aba e aberta pela 1a vez
  useEffect(() => {
    if (view !== "timeline" || historyLoaded) return;
    setLoadingHistory(true);
    recordApi
      .history(establishmentId, patient._id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => {
        setLoadingHistory(false);
        setHistoryLoaded(true);
      });
  }, [view, historyLoaded, establishmentId, patient._id]);

  useEffect(() => {
    setLoading(true);
    recordApi
      .get(establishmentId, patient._id)
      .then((r) => {
        setAllergies(r.allergies || "");
        setMedications(r.medications || "");
        setObservations(r.observations || "");
        setSavedAllergies(r.allergies || "");
        setNotes(r.notes || []);
      })
      .catch(() => setError("Não foi possível carregar o prontuário."))
      .finally(() => setLoading(false));
  }, [establishmentId, patient._id]);

  const saveAnamnese = async () => {
    setSavingAnamnese(true);
    setError(null);
    try {
      const r: MedicalRecord = await recordApi.update(
        establishmentId,
        patient._id,
        { allergies, medications, observations }
      );
      setSavedAllergies(r.allergies || "");
    } catch {
      setError("Não foi possível salvar a anamnese.");
    } finally {
      setSavingAnamnese(false);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:underline"
      >
        ← Voltar aos pacientes
      </button>

      <h2 className="font-display text-xl font-bold text-ink">{patient.name}</h2>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando prontuário...
        </div>
      ) : (
        <>
          {/* alerta de alergia (seguranca) */}
          {savedAllergies.trim() && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <span aria-hidden="true">⚠️</span>
              <span>Alergias: {savedAllergies}</span>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm font-medium text-red-500">{error}</p>
          )}

          {/* sub-abas */}
          <div className="mt-4 flex gap-1 border-b border-ink/10">
            {(
              [
                ["ficha", "Prontuário"],
                ["evolucao", "Evolução"],
                ["timeline", "Linha do tempo"],
                ...(canPlano
                  ? ([["plano", "Plano de tratamento"]] as [
                      "plano",
                      string
                    ][])
                  : []),
                ...(canDocs
                  ? ([["docs", "Documentos"]] as ["docs", string][])
                  : []),
                ...(canOdonto
                  ? ([["odonto", "Odontograma"]] as ["odonto", string][])
                  : []),
                ...(canOdonto
                  ? ([["perio", "Periograma"]] as ["perio", string][])
                  : []),
                ...(canFisio
                  ? ([["fisio", "Fisioterapia"]] as ["fisio", string][])
                  : []),
              ] as [
                (
                  | "ficha"
                  | "evolucao"
                  | "timeline"
                  | "plano"
                  | "docs"
                  | "odonto"
                  | "perio"
                  | "fisio"
                ),
                string
              ][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${view === key
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-ink/50 hover:text-ink/80"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "evolucao" && (
            <div className="mt-5">
              <Evolutions
                establishmentId={establishmentId}
                clientId={patient._id}
                legacyNotes={notes}
              />
            </div>
          )}

          {view === "timeline" && (
            <div className="mt-5">
              {loadingHistory ? (
                <div className="flex items-center gap-2 py-6 text-ink/50">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
                  Carregando atendimentos...
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
                  Nenhum atendimento concluído ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div
                      key={h._id}
                      className="rounded-xl border border-ink/10 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">
                            {h.serviceTitle}
                          </p>
                          <p className="mt-0.5 text-xs text-ink/50">
                            {h.professionalName
                              ? `com ${h.professionalName} · `
                              : ""}
                            {fmt(h.completedAt || h.scheduledAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-ink">
                            R$ {h.amount.toFixed(2)}
                          </p>
                          {h.method && (
                            <p className="text-xs text-ink/40">
                              {methodLabel(h.method)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "plano" && (
            <div className="mt-5">
              <TreatmentPlans
                establishmentId={establishmentId}
                clientId={patient._id}
              />
            </div>
          )}

          {view === "docs" && (
            <div className="mt-5">
              <PatientDocuments
                establishment={establishment}
                patientName={patient.name}
                patientId={patient._id}
              />
            </div>
          )}

          {view === "odonto" && (
            <div className="mt-5">
              <Odontograma
                establishmentId={establishmentId}
                clientId={patient._id}
                canPlano={canPlano}
              />
            </div>
          )}

          {view === "perio" && (
            <div className="mt-5">
              <Periograma
                establishmentId={establishmentId}
                clientId={patient._id}
              />
            </div>
          )}

          {view === "fisio" && (
            <div className="mt-5">
              <PhysioPanel
                establishmentId={establishmentId}
                clientId={patient._id}
              />
            </div>
          )}

          {view === "ficha" && (
            <>
          {/* Anamnese / ficha de saude */}
          <div className="mt-5 rounded-2xl border border-ink/10 bg-white p-5">
            <h3 className="font-display font-bold text-ink">Ficha de saúde</h3>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Alergias
                </span>
                <textarea
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  rows={2}
                  placeholder="Ex: penicilina, látex..."
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Medicamentos em uso
                </span>
                <textarea
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  rows={2}
                  placeholder="Ex: losartana 50mg..."
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Histórico / observações
                </span>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                  placeholder="Condições, cirurgias, contraindicações..."
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
            </div>

            <button
              onClick={saveAnamnese}
              disabled={savingAnamnese}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {savingAnamnese ? "Salvando..." : "Salvar ficha"}
            </button>
          </div>

          {/* A evolucao do atendimento agora fica na aba "Evolução" (SOAP). */}
          <button
            onClick={() => setView("evolucao")}
            className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500/40 hover:shadow-sm"
          >
            <span>
              <span className="block font-display font-bold text-ink">
                Evolução do atendimento
              </span>
              <span className="block text-sm text-ink/50">
                Registre no formato SOAP na aba Evolução.
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-teal-600">
              Abrir →
            </span>
          </button>
            </>
          )}
        </>
      )}
    </div>
  );
}