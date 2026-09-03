import { useEffect, useMemo, useState } from "react";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import {
  beautyApi,
  BeautyFormula,
  BeautyBeforeAfter,
  SessionPackage,
  LoyaltyCard,
  LoyaltyProgram,
  ConsentTerm,
  BeautyTattoo,
  TattooHealth,
  AestheticAssessment,
  AestheticApplication,
  BrowLashProfile,
  LashMapZone,
  MassageAssessment,
  MassageSession,
} from "../api/beauty";
import { Establishment } from "../api/establishment";
import { hasModule } from "../lib/segments";
import {
  CONSENT_TEMPLATES,
  CONSENT_CATEGORIES,
} from "../lib/consentTemplates";
import { ImageUpload } from "./ImageUpload";
import { deleteUploadByUrl } from "../api/upload";
import { ReturnScheduler } from "./ReturnScheduler";

// sub-abas da ficha do cliente (liberadas por modulo)
type SubTab =
  | "ficha"
  | "formulas"
  | "antesdepois"
  | "pacotes"
  | "fidelidade"
  | "consentimento"
  | "tatuagem"
  | "estetica"
  | "visagismo"
  | "massagem"
  | "retornos";
type SubTabItem = [SubTab, string];

// Aba "Ficha do cliente" (area Beleza): lista clientes -> ficha tecnica
// (cabelo/pele/alergias) + historico de formulas quimicas. Espelha o
// ProntuarioManager da saude, com sub-abas liberadas por modulo.
export function FichaBelezaManager({
  establishment,
}: {
  establishment: Establishment;
}) {
  const establishmentId = establishment._id;
  const canFormulas = hasModule(
    establishment.segment,
    "formulas",
    establishment.category?.slug
  );
  const canBeforeAfter = hasModule(
    establishment.segment,
    "antes_depois",
    establishment.category?.slug
  );
  const canPackages = hasModule(
    establishment.segment,
    "pacotes",
    establishment.category?.slug
  );
  // Fidelidade agora tem aba propria no painel (FidelidadeManager), comum a
  // todas as areas. Desligado aqui para nao duplicar a sub-aba na ficha.
  const canLoyalty = false;
  const canConsent = hasModule(
    establishment.segment,
    "consentimento",
    establishment.category?.slug
  );
  const canTattoo = hasModule(
    establishment.segment,
    "tattoo",
    establishment.category?.slug
  );
  const canEstetica = hasModule(
    establishment.segment,
    "estetica",
    establishment.category?.slug
  );
  const canVisagismo = hasModule(
    establishment.segment,
    "visagismo",
    establishment.category?.slug
  );
  const canMassagem = hasModule(
    establishment.segment,
    "massagem",
    establishment.category?.slug
  );
  const isOwner = establishment.myRole !== "professional";

  const [clients, setClients] = useState<EstablishmentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EstablishmentClient | null>(null);

  useEffect(() => {
    setLoading(true);
    recordApi
      .clients(establishmentId)
      .then(setClients)
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, query]);

  if (selected) {
    return (
      <ClientFile
        establishmentId={establishmentId}
        client={selected}
        canFormulas={canFormulas}
        canBeforeAfter={canBeforeAfter}
        canPackages={canPackages}
        canLoyalty={canLoyalty}
        canConsent={canConsent}
        canTattoo={canTattoo}
        canEstetica={canEstetica}
        canVisagismo={canVisagismo}
        canMassagem={canMassagem}
        isOwner={isOwner}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar cliente pelo nome..."
        className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500"
      />

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando clientes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            {clients.length === 0
              ? "Nenhum cliente ainda. A ficha fica disponível para quem já teve atendimento aqui."
              : "Nenhum cliente encontrado com esse nome."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelected(c)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3 text-left transition hover:border-teal-500/40 hover:shadow-sm"
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
                      {c.bookingCount} atendimento
                      {c.bookingCount !== 1 ? "s" : ""}
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

// ---- Ficha de um cliente ----
function ClientFile({
  establishmentId,
  client,
  canFormulas,
  canBeforeAfter,
  canPackages,
  canLoyalty,
  canConsent,
  canTattoo,
  canEstetica,
  canVisagismo,
  canMassagem,
  isOwner,
  onBack,
}: {
  establishmentId: string;
  client: EstablishmentClient;
  canFormulas: boolean;
  canBeforeAfter: boolean;
  canPackages: boolean;
  canLoyalty: boolean;
  canConsent: boolean;
  canTattoo: boolean;
  canEstetica: boolean;
  canVisagismo: boolean;
  canMassagem: boolean;
  isOwner: boolean;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hairType, setHairType] = useState("");
  const [scalpSkin, setScalpSkin] = useState("");
  const [allergies, setAllergies] = useState("");
  const [sensitivities, setSensitivities] = useState("");
  const [chemicalHistory, setChemicalHistory] = useState("");
  const [observations, setObservations] = useState("");
  const [savedAllergies, setSavedAllergies] = useState("");
  const [saving, setSaving] = useState(false);

  const [view, setView] = useState<SubTab>("ficha");

  useEffect(() => {
    setLoading(true);
    beautyApi
      .getRecord(establishmentId, client._id)
      .then((r) => {
        setHairType(r.hairType || "");
        setScalpSkin(r.scalpSkin || "");
        setAllergies(r.allergies || "");
        setSensitivities(r.sensitivities || "");
        setChemicalHistory(r.chemicalHistory || "");
        setObservations(r.observations || "");
        setSavedAllergies(r.allergies || "");
      })
      .catch(() => setError("Não foi possível carregar a ficha."))
      .finally(() => setLoading(false));
  }, [establishmentId, client._id]);

  const saveFicha = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await beautyApi.updateRecord(establishmentId, client._id, {
        hairType,
        scalpSkin,
        allergies,
        sensitivities,
        chemicalHistory,
        observations,
      });
      setSavedAllergies(r.allergies || "");
    } catch {
      setError("Não foi possível salvar a ficha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:underline"
      >
        ← Voltar aos clientes
      </button>

      <h2 className="font-display text-xl font-bold text-ink">{client.name}</h2>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando ficha...
        </div>
      ) : (
        <>
          {savedAllergies.trim() && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <span aria-hidden="true">⚠️</span>
              <span>Alergias: {savedAllergies}</span>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm font-medium text-red-500">{error}</p>
          )}

          <div className="mt-4 flex gap-1 border-b border-ink/10">
            {(
              [
                ["ficha", "Ficha técnica"],
                ["retornos", "Retornos"],
                ...(canFormulas
                  ? ([["formulas", "Fórmulas"]] as SubTabItem[])
                  : []),
                ...(canBeforeAfter
                  ? ([["antesdepois", "Antes & depois"]] as SubTabItem[])
                  : []),
                ...(canPackages
                  ? ([["pacotes", "Pacotes"]] as SubTabItem[])
                  : []),
                ...(canLoyalty
                  ? ([["fidelidade", "Fidelidade"]] as SubTabItem[])
                  : []),
                ...(canConsent
                  ? ([["consentimento", "Consentimento"]] as SubTabItem[])
                  : []),
                ...(canTattoo
                  ? ([["tatuagem", "Tatuagem"]] as SubTabItem[])
                  : []),
                ...(canEstetica
                  ? ([["estetica", "Estética"]] as SubTabItem[])
                  : []),
                ...(canVisagismo
                  ? ([["visagismo", "Sobrancelha & cílios"]] as SubTabItem[])
                  : []),
                ...(canMassagem
                  ? ([["massagem", "Massagem"]] as SubTabItem[])
                  : []),
              ] as SubTabItem[]
            ).map(([key, label]) => (
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

          {view === "ficha" && (
            <div className="mt-5 rounded-2xl border border-ink/10 bg-white p-5">
              <h3 className="font-display font-bold text-ink">
                Ficha técnica
              </h3>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Tipo / textura de cabelo
                  </span>
                  <input
                    value={hairType}
                    onChange={(e) => setHairType(e.target.value)}
                    placeholder="Ex: cacheado, fino, oleoso..."
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Couro cabeludo / pele
                  </span>
                  <input
                    value={scalpSkin}
                    onChange={(e) => setScalpSkin(e.target.value)}
                    placeholder="Ex: sensível, seco, com dermatite..."
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
              </div>

              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Alergias
                  </span>
                  <textarea
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    rows={2}
                    placeholder="Ex: amônia, níquel, henna..."
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Sensibilidades / reações anteriores
                  </span>
                  <textarea
                    value={sensitivities}
                    onChange={(e) => setSensitivities(e.target.value)}
                    rows={2}
                    placeholder="Reações a química, teste de mecha, ardência..."
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Histórico químico
                  </span>
                  <textarea
                    value={chemicalHistory}
                    onChange={(e) => setChemicalHistory(e.target.value)}
                    rows={2}
                    placeholder="Alisamentos, colorações, descolorações anteriores..."
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Observações
                  </span>
                  <textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    rows={3}
                    placeholder="Preferências, contraindicações, anotações..."
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
              </div>

              <button
                onClick={saveFicha}
                disabled={saving}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar ficha"}
              </button>
            </div>
          )}

          {view === "formulas" && canFormulas && (
            <div className="mt-5">
              <FormulasView
                establishmentId={establishmentId}
                clientId={client._id}
              />
            </div>
          )}

          {view === "antesdepois" && canBeforeAfter && (
            <div className="mt-5">
              <BeforeAfterView
                establishmentId={establishmentId}
                clientId={client._id}
              />
            </div>
          )}

          {view === "pacotes" && canPackages && (
            <div className="mt-5">
              <PackagesView
                establishmentId={establishmentId}
                clientId={client._id}
              />
            </div>
          )}

          {view === "fidelidade" && canLoyalty && (
            <div className="mt-5">
              <LoyaltyView
                establishmentId={establishmentId}
                clientId={client._id}
                isOwner={isOwner}
              />
            </div>
          )}

          {view === "consentimento" && canConsent && (
            <div className="mt-5">
              <ConsentView
                establishmentId={establishmentId}
                clientId={client._id}
              />
            </div>
          )}

          {view === "tatuagem" && canTattoo && (
            <div className="mt-5">
              <TattooView
                establishmentId={establishmentId}
                clientId={client._id}
              />
            </div>
          )}

          {view === "estetica" && canEstetica && (
            <div className="mt-5">
              <AestheticView
                establishmentId={establishmentId}
                clientId={client._id}
              />
            </div>
          )}

          {view === "visagismo" && canVisagismo && (
            <div className="mt-5">
              <BrowLashView
                establishmentId={establishmentId}
                clientId={client._id}
              />
            </div>
          )}

          {view === "massagem" && canMassagem && (
            <div className="mt-5">
              <MassageView
                establishmentId={establishmentId}
                clientId={client._id}
              />
            </div>
          )}

          {view === "retornos" && (
            <div className="mt-5">
              <ReturnScheduler
                establishmentId={establishmentId}
                clientId={client._id}
                title="Agendar retorno"
                hint="Reagende o cliente — retoque, manutenção ou próxima sessão. Só aparecem horários livres e o agendamento entra direto na sua agenda."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Historico de formulas de um cliente ----
function FormulasView({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [formulas, setFormulas] = useState<BeautyFormula[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [formula, setFormula] = useState("");
  const [oxidant, setOxidant] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    beautyApi
      .listFormulas(establishmentId, clientId)
      .then(setFormulas)
      .catch(() => setError("Não foi possível carregar as fórmulas."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [establishmentId, clientId]);

  const resetForm = () => {
    setCategory("");
    setBrand("");
    setFormula("");
    setOxidant("");
    setTimeMinutes("");
    setResult("");
  };

  const add = async () => {
    if (!formula.trim()) {
      setError("Informe a fórmula.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await beautyApi.addFormula(establishmentId, clientId, {
        category: category.trim(),
        brand: brand.trim(),
        formula: formula.trim(),
        oxidant: oxidant.trim(),
        timeMinutes: Number(timeMinutes) || 0,
        result: result.trim(),
      });
      setFormulas((prev) => [created, ...prev]);
      resetForm();
      setShowForm(false);
    } catch {
      setError("Não foi possível registrar a fórmula.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await beautyApi.removeFormula(establishmentId, clientId, id);
      setFormulas((prev) => prev.filter((f) => f._id !== id));
    } catch {
      setError("Não foi possível remover a fórmula.");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const authorName = (a: BeautyFormula["author"]) =>
    typeof a === "object" && a ? a.name : "";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-ink">
          Histórico de fórmulas
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Nova fórmula"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

      {showForm && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Tipo de procedimento
              </span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Coloração, mechas, alisamento..."
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Marca
              </span>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex: Wella, L'Oréal..."
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Fórmula
            </span>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              rows={2}
              placeholder="Ex: 7.1 + 8.1 (partes iguais)..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Oxidante
              </span>
              <input
                value={oxidant}
                onChange={(e) => setOxidant(e.target.value)}
                placeholder="Ex: 20 vol"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Tempo de ação (min)
              </span>
              <input
                type="number"
                min={0}
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(e.target.value)}
                placeholder="Ex: 35"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Resultado / observação
            </span>
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              rows={2}
              placeholder="Como ficou, o que ajustar na próxima..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <button
            onClick={add}
            disabled={saving}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar fórmula"}
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando fórmulas...
          </div>
        ) : formulas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            Nenhuma fórmula registrada ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {formulas.map((f) => (
              <div
                key={f._id}
                className="rounded-xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {f.category || "Fórmula"}
                      {f.brand ? ` · ${f.brand}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {fmtDate(f.date)}
                      {authorName(f.author) ? ` · ${authorName(f.author)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(f._id)}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                <div className="mt-2 text-sm text-ink/80">
                  {f.formula && (
                    <p>
                      <span className="font-medium text-ink/60">Fórmula: </span>
                      {f.formula}
                    </p>
                  )}
                  {(f.oxidant || f.timeMinutes > 0) && (
                    <p className="mt-0.5 text-ink/60">
                      {f.oxidant ? `Oxidante ${f.oxidant}` : ""}
                      {f.oxidant && f.timeMinutes > 0 ? " · " : ""}
                      {f.timeMinutes > 0 ? `${f.timeMinutes} min` : ""}
                    </p>
                  )}
                  {f.result && (
                    <p className="mt-0.5">
                      <span className="font-medium text-ink/60">
                        Resultado:{" "}
                      </span>
                      {f.result}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Antes & depois de um cliente ----
function BeforeAfterView({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [items, setItems] = useState<BeautyBeforeAfter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [beforeUrl, setBeforeUrl] = useState("");
  const [afterUrl, setAfterUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    beautyApi
      .listBeforeAfter(establishmentId, clientId)
      .then(setItems)
      .catch(() => setError("Não foi possível carregar os registros."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [establishmentId, clientId]);

  const resetForm = () => {
    setBeforeUrl("");
    setAfterUrl("");
    setNote("");
  };

  const add = async () => {
    if (!beforeUrl && !afterUrl) {
      setError("Envie ao menos uma foto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await beautyApi.addBeforeAfter(
        establishmentId,
        clientId,
        { beforeUrl, afterUrl, note: note.trim() }
      );
      setItems((prev) => [created, ...prev]);
      resetForm();
      setShowForm(false);
    } catch {
      setError("Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await beautyApi.removeBeforeAfter(
        establishmentId,
        clientId,
        id
      );
      // limpa os objetos no S3 (falha silenciosa)
      if (res.beforeUrl) void deleteUploadByUrl(res.beforeUrl);
      if (res.afterUrl) void deleteUploadByUrl(res.afterUrl);
      setItems((prev) => prev.filter((i) => i._id !== id));
    } catch {
      setError("Não foi possível remover o registro.");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const authorName = (a: BeautyBeforeAfter["author"]) =>
    typeof a === "object" && a ? a.name : "";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-ink">Antes & depois</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Novo registro"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

      {showForm && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUpload
              value={beforeUrl}
              onChange={setBeforeUrl}
              folder="galeria"
              label="Antes"
              hint="JPG, PNG ou WEBP (até 5 MB)"
            />
            <ImageUpload
              value={afterUrl}
              onChange={setAfterUrl}
              folder="galeria"
              label="Depois"
              hint="JPG, PNG ou WEBP (até 5 MB)"
            />
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Observação
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Procedimento, produtos usados, resultado..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <button
            onClick={add}
            disabled={saving}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar registro"}
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando registros...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            Nenhum registro de antes & depois ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div
                key={it._id}
                className="rounded-xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-ink/50">
                    {fmtDate(it.date)}
                    {authorName(it.author) ? ` · ${authorName(it.author)}` : ""}
                  </p>
                  <button
                    onClick={() => remove(it._id)}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-3">
                  <figure>
                    <figcaption className="mb-1 text-xs font-medium text-ink/50">
                      Antes
                    </figcaption>
                    {it.beforeUrl ? (
                      <img
                        src={it.beforeUrl}
                        alt="Antes"
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-ink/20 text-2xl text-ink/25">
                        🖼
                      </div>
                    )}
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-xs font-medium text-ink/50">
                      Depois
                    </figcaption>
                    {it.afterUrl ? (
                      <img
                        src={it.afterUrl}
                        alt="Depois"
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-ink/20 text-2xl text-ink/25">
                        🖼
                      </div>
                    )}
                  </figure>
                </div>

                {it.note && (
                  <p className="mt-2 text-sm text-ink/80">{it.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Pacotes de sessoes de um cliente ----
function PackagesView({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [totalSessions, setTotalSessions] = useState("10");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    beautyApi
      .listPackages(establishmentId, clientId)
      .then(setPackages)
      .catch(() => setError("Não foi possível carregar os pacotes."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [establishmentId, clientId]);

  const replace = (pkg: SessionPackage) =>
    setPackages((prev) => prev.map((p) => (p._id === pkg._id ? pkg : p)));

  const create = async () => {
    const total = Math.max(1, Math.floor(Number(totalSessions) || 0));
    if (!total) {
      setError("Informe o total de sessões.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await beautyApi.createPackage(establishmentId, clientId, {
        title: title.trim() || undefined,
        totalSessions: total,
        price: Number(price) || 0,
        notes: notes.trim(),
      });
      setPackages((prev) => [created, ...prev]);
      setTitle("");
      setTotalSessions("10");
      setPrice("");
      setNotes("");
      setShowForm(false);
    } catch {
      setError("Não foi possível criar o pacote.");
    } finally {
      setSaving(false);
    }
  };

  const registerUse = async (pkg: SessionPackage) => {
    try {
      const updated = await beautyApi.addPackageUse(
        establishmentId,
        clientId,
        pkg._id
      );
      replace(updated);
    } catch {
      setError("Não foi possível registrar a sessão.");
    }
  };

  const undoUse = async (pkg: SessionPackage, useId: string) => {
    try {
      const updated = await beautyApi.removePackageUse(
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

  const removePkg = async (id: string) => {
    try {
      await beautyApi.removePackage(establishmentId, clientId, id);
      setPackages((prev) => prev.filter((p) => p._id !== id));
    } catch {
      setError("Não foi possível remover o pacote.");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const statusBadge = (status: SessionPackage["status"]) => {
    const map: Record<SessionPackage["status"], string> = {
      ativo: "bg-teal-500/10 text-teal-600",
      concluido: "bg-ink/10 text-ink/60",
      cancelado: "bg-red-500/10 text-red-600",
    };
    const label: Record<SessionPackage["status"], string> = {
      ativo: "Ativo",
      concluido: "Concluído",
      cancelado: "Cancelado",
    };
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status]}`}
      >
        {label[status]}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-ink">Pacotes de sessões</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Novo pacote"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

      {showForm && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Nome do pacote
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: 10 sessões de depilação"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Total de sessões
              </span>
              <input
                type="number"
                min={1}
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Valor (R$)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Observação
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Condições, validade, o que inclui..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <button
            onClick={create}
            disabled={saving}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Criar pacote"}
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando pacotes...
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            Nenhum pacote ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => {
              const used = pkg.uses.length;
              const remaining = Math.max(0, pkg.totalSessions - used);
              const pct = Math.min(
                100,
                Math.round((used / pkg.totalSessions) * 100)
              );
              return (
                <div
                  key={pkg._id}
                  className="rounded-xl border border-ink/10 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink">{pkg.title}</p>
                        {statusBadge(pkg.status)}
                      </div>
                      <p className="mt-0.5 text-xs text-ink/50">
                        {remaining} de {pkg.totalSessions} restantes
                        {pkg.price > 0 ? ` · R$ ${pkg.price.toFixed(2)}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => removePkg(pkg._id)}
                      className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {pkg.notes && (
                    <p className="mt-2 text-sm text-ink/70">{pkg.notes}</p>
                  )}

                  {pkg.status === "ativo" && remaining > 0 && (
                    <button
                      onClick={() => registerUse(pkg)}
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-teal-500/40 px-4 text-sm font-semibold text-teal-600 transition hover:bg-teal-500/10"
                    >
                      + Registrar sessão
                    </button>
                  )}

                  {used > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-ink/10 pt-3">
                      {pkg.uses.map((u, i) => (
                        <div
                          key={u._id}
                          className="flex items-center justify-between gap-2 text-sm text-ink/70"
                        >
                          <span>
                            Sessão {i + 1} · {fmtDate(u.date)}
                            {u.note ? ` · ${u.note}` : ""}
                          </span>
                          <button
                            onClick={() => undoUse(pkg, u._id)}
                            className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                          >
                            Estornar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Fidelidade de um cliente ----
function LoyaltyView({
  establishmentId,
  clientId,
  isOwner,
}: {
  establishmentId: string;
  clientId: string;
  isOwner: boolean;
}) {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState("10");
  const [rewardInput, setRewardInput] = useState("");
  const [activeInput, setActiveInput] = useState(true);
  const [savingProgram, setSavingProgram] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      beautyApi.getProgram(establishmentId),
      beautyApi.getCard(establishmentId, clientId),
    ])
      .then(([p, c]) => {
        setProgram(p);
        setCard(c);
        setGoalInput(String(p.goal));
        setRewardInput(p.reward || "");
        setActiveInput(p.active);
      })
      .catch(() => setError("Não foi possível carregar a fidelidade."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const saveProgram = async () => {
    setSavingProgram(true);
    setError(null);
    try {
      const p = await beautyApi.setProgram(establishmentId, {
        goal: Math.max(1, Math.floor(Number(goalInput) || 1)),
        reward: rewardInput.trim(),
        active: activeInput,
      });
      setProgram(p);
      setEditing(false);
    } catch {
      setError("Não foi possível salvar o programa.");
    } finally {
      setSavingProgram(false);
    }
  };

  const stamp = async () => {
    try {
      setCard(await beautyApi.addStamp(establishmentId, clientId));
    } catch {
      setError("Não foi possível carimbar.");
    }
  };

  const unstamp = async () => {
    try {
      setCard(await beautyApi.removeStamp(establishmentId, clientId));
    } catch {
      setError("Não foi possível estornar.");
    }
  };

  const redeem = async () => {
    try {
      setCard(await beautyApi.redeemReward(establishmentId, clientId));
    } catch {
      setError("Não foi possível resgatar.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando fidelidade...
      </div>
    );
  }

  const goal = program?.goal ?? 10;
  const stamps = card?.stamps ?? 0;
  const canRedeem = !!program?.active && stamps >= goal;
  const dots = Array.from({ length: goal }, (_, i) => i < stamps);

  return (
    <div>
      {error && <p className="mb-3 text-sm font-medium text-red-500">{error}</p>}

      {/* programa (config do estabelecimento) */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-ink">
              Programa de fidelidade
            </h3>
            {!editing && (
              <p className="mt-1 text-sm text-ink/60">
                {program?.active
                  ? `A cada ${goal} carimbos: ${
                      program?.reward || "recompensa a definir"
                    }`
                  : "Programa desativado"}
              </p>
            )}
          </div>
          {isOwner && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 text-sm font-semibold text-teal-600 hover:underline"
            >
              Configurar
            </button>
          )}
        </div>

        {editing && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Carimbos para a recompensa
                </span>
                <input
                  type="number"
                  min={1}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Recompensa
                </span>
                <input
                  value={rewardInput}
                  onChange={(e) => setRewardInput(e.target.value)}
                  placeholder="Ex: 1 corte grátis"
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={activeInput}
                onChange={(e) => setActiveInput(e.target.checked)}
                className="h-4 w-4 rounded border-ink/30 text-teal-500 focus:ring-teal-500"
              />
              Programa ativo
            </label>
            <div className="flex gap-2">
              <button
                onClick={saveProgram}
                disabled={savingProgram}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {savingProgram ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-ink/15 px-5 text-sm font-medium text-ink/70 transition hover:border-ink/30"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* cartao do cliente */}
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="font-medium text-ink">
            {stamps} de {goal} carimbos
          </p>
          {(card?.rewardsGiven ?? 0) > 0 && (
            <span className="text-xs text-ink/50">
              {card?.rewardsGiven} recompensa
              {(card?.rewardsGiven ?? 0) !== 1 ? "s" : ""} resgatada
              {(card?.rewardsGiven ?? 0) !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {dots.map((filled, i) => (
            <span
              key={i}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${
                filled
                  ? "border-teal-500 bg-teal-500 text-white"
                  : "border-ink/20 text-ink/30"
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={stamp}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            + Carimbar
          </button>
          {stamps > 0 && (
            <button
              onClick={unstamp}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-ink/15 px-5 text-sm font-medium text-ink/70 transition hover:border-ink/30"
            >
              Estornar
            </button>
          )}
          {canRedeem && (
            <button
              onClick={redeem}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-ink transition hover:bg-amber-500"
            >
              Resgatar recompensa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Consentimento de um cliente ----
function ConsentView({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [terms, setTerms] = useState<ConsentTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [kind, setKind] = useState<"procedimento" | "imagem" | "outro">(
    "procedimento"
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [signedName, setSignedName] = useState("");
  const [signed, setSigned] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    beautyApi
      .listConsents(establishmentId, clientId)
      .then(setTerms)
      .catch(() => setError("Não foi possível carregar os termos."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [establishmentId, clientId]);

  const resetForm = () => {
    setKind("procedimento");
    setTitle("");
    setContent("");
    setSignedName("");
    setSigned(false);
    setAttachmentUrl("");
  };

  // preenche o formulário a partir de um modelo por procedimento
  const applyTemplate = (id: string) => {
    const t = CONSENT_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setKind(t.kind);
    setTitle(t.title);
    setContent(t.content);
  };

  const add = async () => {
    if (!title.trim()) {
      setError("Informe o título do termo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await beautyApi.createConsent(establishmentId, clientId, {
        kind,
        title: title.trim(),
        content: content.trim(),
        signedName: signedName.trim(),
        signed,
        attachmentUrl,
      });
      setTerms((prev) => [created, ...prev]);
      resetForm();
      setShowForm(false);
    } catch {
      setError("Não foi possível salvar o termo.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSign = async (term: ConsentTerm) => {
    try {
      const updated = await beautyApi.signConsent(
        establishmentId,
        clientId,
        term._id,
        { signed: !term.signedAt }
      );
      setTerms((prev) => prev.map((t) => (t._id === term._id ? updated : t)));
    } catch {
      setError("Não foi possível atualizar o termo.");
    }
  };

  const remove = async (term: ConsentTerm) => {
    try {
      const res = await beautyApi.removeConsent(
        establishmentId,
        clientId,
        term._id
      );
      if (res.attachmentUrl) void deleteUploadByUrl(res.attachmentUrl);
      setTerms((prev) => prev.filter((t) => t._id !== term._id));
    } catch {
      setError("Não foi possível remover o termo.");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const kindLabel: Record<ConsentTerm["kind"], string> = {
    procedimento: "Procedimento",
    imagem: "Uso de imagem",
    outro: "Outro",
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-ink">
          Termos e autorizações
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Novo termo"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

      {showForm && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <label className="mb-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Modelo por procedimento (opcional)
            </span>
            <select
              value=""
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="">Escolher um modelo…</option>
              {CONSENT_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {CONSENT_TEMPLATES.filter((t) => t.category === cat).map(
                    (t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    )
                  )}
                </optgroup>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink/40">
              Preenche tipo, título e texto — você pode editar antes de salvar.
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Tipo
              </span>
              <select
                value={kind}
                onChange={(e) =>
                  setKind(
                    e.target.value as "procedimento" | "imagem" | "outro"
                  )
                }
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                <option value="procedimento">Procedimento</option>
                <option value="imagem">Uso de imagem</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Título
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Autorização de uso de imagem"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Texto do termo
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Conteúdo do termo / autorização..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Nome de quem assina
              </span>
              <input
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                placeholder="Nome do cliente / responsável"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input
                  type="checkbox"
                  checked={signed}
                  onChange={(e) => setSigned(e.target.checked)}
                  className="h-4 w-4 rounded border-ink/30 text-teal-500 focus:ring-teal-500"
                />
                Marcar como assinado agora
              </label>
            </div>
          </div>

          <div className="mt-3">
            <ImageUpload
              value={attachmentUrl}
              onChange={setAttachmentUrl}
              folder="galeria"
              label="Foto do documento assinado (opcional)"
              hint="JPG, PNG ou WEBP (até 5 MB)"
            />
          </div>

          <button
            onClick={add}
            disabled={saving}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar termo"}
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando termos...
          </div>
        ) : terms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            Nenhum termo registrado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {terms.map((t) => (
              <div
                key={t._id}
                className="rounded-xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink/60">
                        {kindLabel[t.kind]}
                      </span>
                      <p className="font-medium text-ink">{t.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-ink/50">
                      {t.signedAt
                        ? `Assinado${
                            t.signedName ? ` por ${t.signedName}` : ""
                          } em ${fmtDate(t.signedAt)}`
                        : "Não assinado"}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(t)}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                {t.content && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">
                    {t.content}
                  </p>
                )}

                {t.attachmentUrl && (
                  <a
                    href={t.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block"
                  >
                    <img
                      src={t.attachmentUrl}
                      alt="Documento assinado"
                      className="h-24 rounded-lg object-cover"
                    />
                  </a>
                )}

                <button
                  onClick={() => toggleSign(t)}
                  className="mt-3 text-sm font-semibold text-teal-600 hover:underline"
                >
                  {t.signedAt ? "Marcar como não assinado" : "Marcar como assinado"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Tatuagem (extra da categoria tatuagem) ----
const TATTOO_STATUS_LABEL: Record<BeautyTattoo["status"], string> = {
  orcamento: "Orçamento",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const TATTOO_CONDITIONS: { key: string; label: string }[] = [
  { key: "diabetes", label: "Diabetes" },
  { key: "hepatite", label: "Hepatite" },
  { key: "hiv", label: "HIV / AIDS" },
  { key: "cardiaco", label: "Problema cardíaco" },
  { key: "hipertensao", label: "Hipertensão" },
  { key: "epilepsia", label: "Epilepsia" },
  { key: "alergia_latex", label: "Alergia a látex" },
  { key: "queloide", label: "Tendência a queloide" },
  { key: "coagulacao", label: "Distúrbio de coagulação" },
  { key: "anticoagulante", label: "Uso de anticoagulante" },
];

function TattooView({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [pieces, setPieces] = useState<BeautyTattoo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [bodyRegion, setBodyRegion] = useState("");
  const [size, setSize] = useState("");
  const [style, setStyle] = useState("");
  const [sessionsPlanned, setSessionsPlanned] = useState("1");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [quotePrice, setQuotePrice] = useState("");
  const [depositPaid, setDepositPaid] = useState("");
  const [aftercare, setAftercare] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // form de sessao por peca
  const [sessionFor, setSessionFor] = useState<string | null>(null);
  const [sessionNote, setSessionNote] = useState("");
  const [sessionHealing, setSessionHealing] = useState("");

  // declaracao de saude (por cliente)
  const [health, setHealth] = useState<TattooHealth | null>(null);
  const [showHealth, setShowHealth] = useState(false);
  const [conditions, setConditions] = useState<string[]>([]);
  const [hAllergies, setHAllergies] = useState("");
  const [hMedications, setHMedications] = useState("");
  const [hPregnant, setHPregnant] = useState(false);
  const [hOther, setHOther] = useState("");
  const [hSignedName, setHSignedName] = useState("");
  const [savingHealth, setSavingHealth] = useState(false);

  const load = () => {
    setLoading(true);
    beautyApi
      .listTattoos(establishmentId, clientId)
      .then(setPieces)
      .catch(() => setError("Não foi possível carregar as tatuagens."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [establishmentId, clientId]);

  useEffect(() => {
    beautyApi
      .getTattooHealth(establishmentId, clientId)
      .then((h) => {
        setHealth(h);
        setConditions(h.conditions || []);
        setHAllergies(h.allergies || "");
        setHMedications(h.medications || "");
        setHPregnant(!!h.pregnant);
        setHOther(h.other || "");
        setHSignedName(h.signedName || "");
      })
      .catch(() => {
        /* silencioso: a declaracao e opcional */
      });
  }, [establishmentId, clientId]);

  const toggleCondition = (key: string) =>
    setConditions((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );

  const saveHealth = async (signed: boolean) => {
    setSavingHealth(true);
    setError(null);
    try {
      const h = await beautyApi.updateTattooHealth(establishmentId, clientId, {
        conditions,
        allergies: hAllergies.trim(),
        medications: hMedications.trim(),
        pregnant: hPregnant,
        other: hOther.trim(),
        signedName: hSignedName.trim(),
        signed,
      });
      setHealth(h);
      setShowHealth(false);
    } catch {
      setError("Não foi possível salvar a declaração.");
    } finally {
      setSavingHealth(false);
    }
  };

  const replace = (piece: BeautyTattoo) =>
    setPieces((prev) => prev.map((p) => (p._id === piece._id ? piece : p)));

  const create = async () => {
    if (!title.trim()) {
      setError("Informe o nome da tatuagem.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await beautyApi.createTattoo(establishmentId, clientId, {
        title: title.trim(),
        bodyRegion: bodyRegion.trim(),
        size: size.trim(),
        style: style.trim(),
        sessionsPlanned: Math.max(1, Math.floor(Number(sessionsPlanned) || 1)),
        referenceUrl,
        quotePrice: Number(quotePrice) || 0,
        depositPaid: Number(depositPaid) || 0,
        aftercare: aftercare.trim(),
        notes: notes.trim(),
      });
      setPieces((prev) => [created, ...prev]);
      setTitle("");
      setBodyRegion("");
      setSize("");
      setStyle("");
      setSessionsPlanned("1");
      setReferenceUrl("");
      setQuotePrice("");
      setDepositPaid("");
      setAftercare("");
      setNotes("");
      setShowForm(false);
    } catch {
      setError("Não foi possível criar a tatuagem.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (piece: BeautyTattoo, status: string) => {
    try {
      const updated = await beautyApi.updateTattoo(
        establishmentId,
        clientId,
        piece._id,
        { status: status as BeautyTattoo["status"] }
      );
      replace(updated);
    } catch {
      setError("Não foi possível atualizar o status.");
    }
  };

  const addSession = async (piece: BeautyTattoo) => {
    try {
      const updated = await beautyApi.addTattooSession(
        establishmentId,
        clientId,
        piece._id,
        { note: sessionNote.trim(), healing: sessionHealing.trim() }
      );
      replace(updated);
      setSessionFor(null);
      setSessionNote("");
      setSessionHealing("");
    } catch {
      setError("Não foi possível registrar a sessão.");
    }
  };

  const removeSession = async (piece: BeautyTattoo, sessionId: string) => {
    try {
      const updated = await beautyApi.removeTattooSession(
        establishmentId,
        clientId,
        piece._id,
        sessionId
      );
      replace(updated);
    } catch {
      setError("Não foi possível remover a sessão.");
    }
  };

  const removePiece = async (piece: BeautyTattoo) => {
    try {
      const res = await beautyApi.removeTattoo(
        establishmentId,
        clientId,
        piece._id
      );
      if (res.referenceUrl) void deleteUploadByUrl(res.referenceUrl);
      setPieces((prev) => prev.filter((p) => p._id !== piece._id));
    } catch {
      setError("Não foi possível remover a tatuagem.");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-ink">Tatuagens</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Nova tatuagem"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

      {/* declaracao de saude (por cliente) */}
      {(() => {
        const flags: string[] = [];
        if (health) {
          (health.conditions || []).forEach((c) => {
            const f = TATTOO_CONDITIONS.find((x) => x.key === c);
            flags.push(f ? f.label : c);
          });
          if (health.pregnant) flags.push("gestante");
          if (health.allergies) flags.push(`alergias: ${health.allergies}`);
        }
        return (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-ink">
                  Declaração de saúde
                </h3>
                <p className="mt-0.5 text-xs text-ink/50">
                  {health?.signedAt
                    ? `Assinada${
                        health.signedName ? ` por ${health.signedName}` : ""
                      } em ${new Date(health.signedAt).toLocaleDateString(
                        "pt-BR"
                      )}`
                    : "Não assinada"}
                </p>
              </div>
              <button
                onClick={() => setShowHealth((v) => !v)}
                className="shrink-0 text-sm font-semibold text-teal-600 hover:underline"
              >
                {showHealth ? "Fechar" : "Preencher"}
              </button>
            </div>

            {flags.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                <span aria-hidden="true">⚠️</span>
                <span>{flags.join(" · ")}</span>
              </div>
            )}

            {showHealth && (
              <div className="mt-4 space-y-3">
                <div>
                  <span className="mb-2 block text-sm font-medium text-ink/70">
                    Condições
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {TATTOO_CONDITIONS.map((c) => {
                      const on = conditions.includes(c.key);
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => toggleCondition(c.key)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            on
                              ? "border-red-400 bg-red-50 text-red-700"
                              : "border-ink/15 text-ink/60 hover:border-ink/30"
                          }`}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Alergias
                  </span>
                  <input
                    value={hAllergies}
                    onChange={(e) => setHAllergies(e.target.value)}
                    placeholder="Ex: pigmentos, látex, anestésico..."
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Medicações em uso
                  </span>
                  <input
                    value={hMedications}
                    onChange={(e) => setHMedications(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink/70">
                  <input
                    type="checkbox"
                    checked={hPregnant}
                    onChange={(e) => setHPregnant(e.target.checked)}
                    className="h-4 w-4 rounded border-ink/30 text-teal-500 focus:ring-teal-500"
                  />
                  Gestante
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Outras informações
                  </span>
                  <textarea
                    value={hOther}
                    onChange={(e) => setHOther(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink/70">
                    Nome de quem declara
                  </span>
                  <input
                    value={hSignedName}
                    onChange={(e) => setHSignedName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => saveHealth(true)}
                    disabled={savingHealth}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
                  >
                    {savingHealth ? "Salvando..." : "Salvar e assinar"}
                  </button>
                  <button
                    onClick={() => saveHealth(false)}
                    disabled={savingHealth}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-ink/15 px-5 text-sm font-medium text-ink/70 transition hover:border-ink/30 disabled:opacity-60"
                  >
                    Salvar sem assinar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {showForm && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Nome / descrição
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Leão realista no braço"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Região do corpo
              </span>
              <input
                value={bodyRegion}
                onChange={(e) => setBodyRegion(e.target.value)}
                placeholder="Ex: antebraço direito"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Tamanho
              </span>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="Ex: 15 cm"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Estilo
              </span>
              <input
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="Ex: fineline, blackwork..."
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Sessões previstas
              </span>
              <input
                type="number"
                min={1}
                value={sessionsPlanned}
                onChange={(e) => setSessionsPlanned(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Observações
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Orçamento, referências, cuidados..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <div className="mt-3">
            <ImageUpload
              value={referenceUrl}
              onChange={setReferenceUrl}
              folder="galeria"
              label="Arte / referência (opcional)"
              hint="JPG, PNG ou WEBP (até 5 MB)"
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Orçamento (R$)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={quotePrice}
                onChange={(e) => setQuotePrice(e.target.value)}
                placeholder="Valor total"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Sinal pago (R$)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={depositPaid}
                onChange={(e) => setDepositPaid(e.target.value)}
                placeholder="Para segurar a data"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Cuidados pós (aftercare)
            </span>
            <textarea
              value={aftercare}
              onChange={(e) => setAftercare(e.target.value)}
              rows={2}
              placeholder="Instruções de cicatrização entregues ao cliente..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <button
            onClick={create}
            disabled={saving}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar tatuagem"}
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando tatuagens...
          </div>
        ) : pieces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            Nenhuma tatuagem registrada ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {pieces.map((p) => (
              <div
                key={p._id}
                className="rounded-xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{p.title}</p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {[p.bodyRegion, p.size, p.style]
                        .filter(Boolean)
                        .join(" · ")}
                      {p.sessions.length > 0
                        ? ` · ${p.sessions.length}/${p.sessionsPlanned} sessões`
                        : ` · ${p.sessionsPlanned} sessão(ões) prevista(s)`}
                    </p>
                  </div>
                  <button
                    onClick={() => removePiece(p)}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                {p.referenceUrl && (
                  <a
                    href={p.referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block"
                  >
                    <img
                      src={p.referenceUrl}
                      alt="Arte de referência"
                      className="h-28 rounded-lg object-cover"
                    />
                  </a>
                )}

                {(p.quotePrice > 0 || p.depositPaid > 0) && (
                  <p className="mt-2 text-sm text-ink/70">
                    <span className="font-medium text-ink/60">Orçamento: </span>
                    R$ {p.quotePrice.toFixed(2)}
                    {p.depositPaid > 0 && (
                      <>
                        {" · "}
                        <span className="font-medium text-ink/60">
                          sinal:{" "}
                        </span>
                        R$ {p.depositPaid.toFixed(2)}
                        {p.quotePrice > 0 && (
                          <span className="text-ink/50">
                            {" "}
                            (falta R$ {(p.quotePrice - p.depositPaid).toFixed(2)})
                          </span>
                        )}
                      </>
                    )}
                  </p>
                )}

                {p.aftercare && (
                  <p className="mt-1 text-sm text-ink/70">
                    <span className="font-medium text-ink/60">Aftercare: </span>
                    {p.aftercare}
                  </p>
                )}

                {p.notes && (
                  <p className="mt-1 text-sm text-ink/70">{p.notes}</p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-ink/50">Status:</span>
                  <select
                    value={p.status}
                    onChange={(e) => changeStatus(p, e.target.value)}
                    className="rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs outline-none focus:border-teal-500"
                  >
                    <option value="orcamento">
                      {TATTOO_STATUS_LABEL.orcamento}
                    </option>
                    <option value="em_andamento">
                      {TATTOO_STATUS_LABEL.em_andamento}
                    </option>
                    <option value="concluido">
                      {TATTOO_STATUS_LABEL.concluido}
                    </option>
                  </select>
                </div>

                {p.sessions.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-ink/10 pt-3">
                    {p.sessions.map((s, i) => (
                      <div
                        key={s._id}
                        className="flex items-start justify-between gap-2 text-sm text-ink/70"
                      >
                        <span>
                          Sessão {i + 1} · {fmtDate(s.date)}
                          {s.note ? ` · ${s.note}` : ""}
                          {s.healing ? ` · cicatrização: ${s.healing}` : ""}
                        </span>
                        <button
                          onClick={() => removeSession(p, s._id)}
                          className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                        >
                          Estornar
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {sessionFor === p._id ? (
                  <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                    <input
                      value={sessionNote}
                      onChange={(e) => setSessionNote(e.target.value)}
                      placeholder="O que foi feito nesta sessão"
                      className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                    />
                    <input
                      value={sessionHealing}
                      onChange={(e) => setSessionHealing(e.target.value)}
                      placeholder="Observação de cicatrização / cuidados"
                      className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => addSession(p)}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
                      >
                        Salvar sessão
                      </button>
                      <button
                        onClick={() => setSessionFor(null)}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-ink/15 px-4 text-sm font-medium text-ink/70 transition hover:border-ink/30"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSessionFor(p._id);
                      setSessionNote("");
                      setSessionHealing("");
                    }}
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-teal-500/40 px-4 text-sm font-semibold text-teal-600 transition hover:bg-teal-500/10"
                  >
                    + Registrar sessão
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Estética: avaliação + mapa de aplicação ----
const FITZPATRICK_LABELS: Record<number, string> = {
  0: "Não avaliado",
  1: "I — muito clara, sempre queima",
  2: "II — clara, queima com facilidade",
  3: "III — morena clara",
  4: "IV — morena moderada",
  5: "V — parda / negra clara",
  6: "VI — negra",
};

const FACE_REGIONS: { key: string; label: string }[] = [
  { key: "testa", label: "Testa" },
  { key: "glabela", label: "Glabela" },
  { key: "periorbital", label: "Periorbital" },
  { key: "malar", label: "Malar" },
  { key: "nasolabial", label: "Nasolabial" },
  { key: "labios", label: "Lábios" },
  { key: "mento", label: "Mento" },
  { key: "mandibula", label: "Mandíbula" },
];

const BODY_REGIONS: { key: string; label: string }[] = [
  { key: "abdomen", label: "Abdômen" },
  { key: "flancos", label: "Flancos" },
  { key: "culote", label: "Culote" },
  { key: "coxas", label: "Coxas" },
  { key: "gluteos", label: "Glúteos" },
  { key: "bracos", label: "Braços" },
  { key: "papada", label: "Papada" },
  { key: "costas", label: "Costas" },
];

function AestheticView({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // avaliacao
  const [fitzpatrick, setFitzpatrick] = useState(0);
  const [skinType, setSkinType] = useState("");
  const [mainComplaint, setMainComplaint] = useState("");
  const [goals, setGoals] = useState("");
  const [contraindications, setContraindications] = useState("");
  const [observations, setObservations] = useState("");
  const [savedContra, setSavedContra] = useState("");
  const [savingAssessment, setSavingAssessment] = useState(false);

  // mapa
  const [apps, setApps] = useState<AestheticApplication[]>([]);
  const [selected, setSelected] = useState<{
    area: "face" | "corpo";
    key: string;
    label: string;
  } | null>(null);

  const [procedure, setProcedure] = useState("");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [savingApp, setSavingApp] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      beautyApi.getAssessment(establishmentId, clientId),
      beautyApi.listApplications(establishmentId, clientId),
    ])
      .then(([a, list]: [AestheticAssessment, AestheticApplication[]]) => {
        setFitzpatrick(a.fitzpatrick || 0);
        setSkinType(a.skinType || "");
        setMainComplaint(a.mainComplaint || "");
        setGoals(a.goals || "");
        setContraindications(a.contraindications || "");
        setObservations(a.observations || "");
        setSavedContra(a.contraindications || "");
        setApps(list);
      })
      .catch(() => setError("Não foi possível carregar a avaliação."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const saveAssessment = async () => {
    setSavingAssessment(true);
    setError(null);
    try {
      const a = await beautyApi.updateAssessment(establishmentId, clientId, {
        fitzpatrick,
        skinType,
        mainComplaint,
        goals,
        contraindications,
        observations,
      });
      setSavedContra(a.contraindications || "");
    } catch {
      setError("Não foi possível salvar a avaliação.");
    } finally {
      setSavingAssessment(false);
    }
  };

  const countFor = (area: "face" | "corpo", key: string) =>
    apps.filter((a) => a.area === area && a.region === key).length;

  const selectedApps = selected
    ? apps.filter((a) => a.area === selected.area && a.region === selected.key)
    : [];

  const addApp = async () => {
    if (!selected) return;
    if (!procedure.trim() && !product.trim()) {
      setError("Informe ao menos o procedimento ou o produto.");
      return;
    }
    setSavingApp(true);
    setError(null);
    try {
      const created = await beautyApi.addApplication(establishmentId, clientId, {
        area: selected.area,
        region: selected.key,
        procedure: procedure.trim(),
        product: product.trim(),
        amount: amount.trim(),
        note: note.trim(),
      });
      setApps((prev) => [created, ...prev]);
      setProcedure("");
      setProduct("");
      setAmount("");
      setNote("");
    } catch {
      setError("Não foi possível registrar a aplicação.");
    } finally {
      setSavingApp(false);
    }
  };

  const removeApp = async (id: string) => {
    try {
      await beautyApi.removeApplication(establishmentId, clientId, id);
      setApps((prev) => prev.filter((a) => a._id !== id));
    } catch {
      setError("Não foi possível remover a aplicação.");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const regionChips = (area: "face" | "corpo", regions: typeof FACE_REGIONS) => (
    <div className="flex flex-wrap gap-2">
      {regions.map((r) => {
        const n = countFor(area, r.key);
        const active = selected?.area === area && selected?.key === r.key;
        return (
          <button
            key={r.key}
            onClick={() => setSelected({ area, key: r.key, label: r.label })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
              active
                ? "border-teal-500 bg-teal-500 text-white"
                : n > 0
                ? "border-teal-500/40 bg-teal-500/10 text-teal-700"
                : "border-ink/15 text-ink/60 hover:border-ink/30"
            }`}
          >
            {r.label}
            {n > 0 && (
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold ${
                  active ? "bg-white/25 text-white" : "bg-teal-500 text-white"
                }`}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando estética...
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm font-medium text-red-500">{error}</p>}

      {savedContra.trim() && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <span aria-hidden="true">⚠️</span>
          <span>Contraindicações: {savedContra}</span>
        </div>
      )}

      {/* avaliacao */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Avaliação estética</h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Fototipo (Fitzpatrick)
            </span>
            <select
              value={fitzpatrick}
              onChange={(e) => setFitzpatrick(Number(e.target.value))}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {FITZPATRICK_LABELS[n]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Tipo de pele
            </span>
            <input
              value={skinType}
              onChange={(e) => setSkinType(e.target.value)}
              placeholder="Oleosa, seca, mista, sensível..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
        </div>

        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Queixa principal
            </span>
            <input
              value={mainComplaint}
              onChange={(e) => setMainComplaint(e.target.value)}
              placeholder="Ex: manchas, flacidez, gordura localizada..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Objetivo do tratamento
            </span>
            <input
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Contraindicações
            </span>
            <textarea
              value={contraindications}
              onChange={(e) => setContraindications(e.target.value)}
              rows={2}
              placeholder="Gestante, isotretinoína, marca-passo, alergias..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Observações
            </span>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
        </div>

        <button
          onClick={saveAssessment}
          disabled={savingAssessment}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {savingAssessment ? "Salvando..." : "Salvar avaliação"}
        </button>
      </div>

      {/* mapa de aplicacao */}
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Mapa de aplicação</h3>
        <p className="mt-1 text-sm text-ink/50">
          Toque numa região para ver o histórico e registrar o que foi aplicado.
        </p>

        <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
          Rosto
        </p>
        {regionChips("face", FACE_REGIONS)}

        <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
          Corpo
        </p>
        {regionChips("corpo", BODY_REGIONS)}

        {selected && (
          <div className="mt-5 rounded-xl border border-ink/10 bg-ink/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">
                {selected.label}
                <span className="ml-2 text-xs font-normal text-ink/50">
                  {selected.area === "face" ? "rosto" : "corpo"}
                </span>
              </p>
              <button
                onClick={() => setSelected(null)}
                className="text-xs font-semibold text-ink/50 hover:underline"
              >
                Fechar
              </button>
            </div>

            {/* historico da regiao */}
            {selectedApps.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedApps.map((a) => (
                  <div
                    key={a._id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-ink/10 bg-white p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {[a.procedure, a.product].filter(Boolean).join(" · ") ||
                          "Aplicação"}
                        {a.amount ? ` (${a.amount})` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-ink/50">
                        {fmtDate(a.date)}
                        {a.note ? ` · ${a.note}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => removeApp(a._id)}
                      className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* nova aplicacao */}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                placeholder="Procedimento"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Produto"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Quantidade (ex: 20 UI)"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observação (opcional)"
              className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
            <button
              onClick={addApp}
              disabled={savingApp}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {savingApp ? "Salvando..." : "Registrar aplicação"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Sobrancelha & cílios: perfil técnico ----
const LASH_ZONES: { key: string; label: string }[] = [
  { key: "canto_interno", label: "Canto interno" },
  { key: "interno_central", label: "Interno-central" },
  { key: "central", label: "Central" },
  { key: "central_externo", label: "Central-externo" },
  { key: "canto_externo", label: "Canto externo" },
];

function BrowLashView({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [faceShape, setFaceShape] = useState("");
  const [browFormat, setBrowFormat] = useState("");
  const [browTechnique, setBrowTechnique] = useState("");
  const [browColor, setBrowColor] = useState("");
  const [browMeasures, setBrowMeasures] = useState("");
  const [browNotes, setBrowNotes] = useState("");

  const [lashTechnique, setLashTechnique] = useState("");
  const [lashCurvature, setLashCurvature] = useState("");
  const [lashThickness, setLashThickness] = useState("");
  const [lashGlue, setLashGlue] = useState("");
  const [lashNotes, setLashNotes] = useState("");
  const [lengths, setLengths] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    beautyApi
      .getBrowLash(establishmentId, clientId)
      .then((p: BrowLashProfile) => {
        setFaceShape(p.faceShape || "");
        setBrowFormat(p.browFormat || "");
        setBrowTechnique(p.browTechnique || "");
        setBrowColor(p.browColor || "");
        setBrowMeasures(p.browMeasures || "");
        setBrowNotes(p.browNotes || "");
        setLashTechnique(p.lashTechnique || "");
        setLashCurvature(p.lashCurvature || "");
        setLashThickness(p.lashThickness || "");
        setLashGlue(p.lashGlue || "");
        setLashNotes(p.lashNotes || "");
        const map: Record<string, string> = {};
        (p.lashMap || []).forEach((z) => {
          map[z.zone] = z.length;
        });
        setLengths(map);
      })
      .catch(() => setError("Não foi possível carregar o perfil."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const lashMap: LashMapZone[] = LASH_ZONES.map((z) => ({
        zone: z.key,
        length: lengths[z.key] || "",
      }));
      await beautyApi.updateBrowLash(establishmentId, clientId, {
        faceShape,
        browFormat,
        browTechnique,
        browColor,
        browMeasures,
        browNotes,
        lashTechnique,
        lashCurvature,
        lashThickness,
        lashGlue,
        lashNotes,
        lashMap,
      });
    } catch {
      setError("Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando perfil...
      </div>
    );
  }

  const field = (
    label: string,
    value: string,
    setter: (v: string) => void,
    placeholder = ""
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/70">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
      />
    </label>
  );

  return (
    <div>
      {error && <p className="mb-3 text-sm font-medium text-red-500">{error}</p>}

      {/* sobrancelha */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Design de sobrancelha</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {field("Formato do rosto", faceShape, setFaceShape, "Oval, redondo, quadrado...")}
          {field("Formato ideal da sobrancelha", browFormat, setBrowFormat, "Arqueada, reta...")}
          {field("Técnica", browTechnique, setBrowTechnique, "Henna, laminação, micro...")}
          {field("Cor / tom", browColor, setBrowColor)}
        </div>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium text-ink/70">
            Medidas (início / ápice / término)
          </span>
          <input
            value={browMeasures}
            onChange={(e) => setBrowMeasures(e.target.value)}
            placeholder="Ex: início na narina, ápice a 2/3, término na linha do olho externo"
            className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium text-ink/70">
            Observações
          </span>
          <textarea
            value={browNotes}
            onChange={(e) => setBrowNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </label>
      </div>

      {/* cilios */}
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Mapping de cílios</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {field("Técnica", lashTechnique, setLashTechnique, "Fio a fio, volume 3D...")}
          {field("Curvatura", lashCurvature, setLashCurvature, "C, D, L...")}
          {field("Espessura", lashThickness, setLashThickness, "0.05, 0.07...")}
          {field("Cola", lashGlue, setLashGlue)}
        </div>

        <p className="mt-4 mb-2 text-sm font-medium text-ink/70">
          Comprimento por zona (mm)
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LASH_ZONES.map((z) => (
            <label key={z.key} className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink/50">
                {z.label}
              </span>
              <input
                value={lengths[z.key] || ""}
                onChange={(e) =>
                  setLengths((prev) => ({ ...prev, [z.key]: e.target.value }))
                }
                placeholder="mm"
                className="w-full rounded-lg border border-ink/15 bg-white px-2 py-2 text-center text-sm outline-none focus:border-teal-500"
              />
            </label>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium text-ink/70">
            Observações
          </span>
          <textarea
            value={lashNotes}
            onChange={(e) => setLashNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar perfil"}
      </button>
    </div>
  );
}

// ---- Massagem: avaliação + evolução por sessão ----
function MassageView({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // avaliacao
  const [mainComplaint, setMainComplaint] = useState("");
  const [tensionPoints, setTensionPoints] = useState("");
  const [contraindications, setContraindications] = useState("");
  const [goals, setGoals] = useState("");
  const [observations, setObservations] = useState("");
  const [savedContra, setSavedContra] = useState("");
  const [savingAssessment, setSavingAssessment] = useState(false);

  // sessoes
  const [sessions, setSessions] = useState<MassageSession[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [technique, setTechnique] = useState("");
  const [regions, setRegions] = useState("");
  const [evolution, setEvolution] = useState("");
  const [painBefore, setPainBefore] = useState("");
  const [painAfter, setPainAfter] = useState("");
  const [savingSession, setSavingSession] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      beautyApi.getMassageAssessment(establishmentId, clientId),
      beautyApi.listMassageSessions(establishmentId, clientId),
    ])
      .then(([a, list]: [MassageAssessment, MassageSession[]]) => {
        setMainComplaint(a.mainComplaint || "");
        setTensionPoints(a.tensionPoints || "");
        setContraindications(a.contraindications || "");
        setGoals(a.goals || "");
        setObservations(a.observations || "");
        setSavedContra(a.contraindications || "");
        setSessions(list);
      })
      .catch(() => setError("Não foi possível carregar a massagem."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const saveAssessment = async () => {
    setSavingAssessment(true);
    setError(null);
    try {
      const a = await beautyApi.updateMassageAssessment(
        establishmentId,
        clientId,
        { mainComplaint, tensionPoints, contraindications, goals, observations }
      );
      setSavedContra(a.contraindications || "");
    } catch {
      setError("Não foi possível salvar a avaliação.");
    } finally {
      setSavingAssessment(false);
    }
  };

  const addSession = async () => {
    setSavingSession(true);
    setError(null);
    try {
      const created = await beautyApi.addMassageSession(
        establishmentId,
        clientId,
        {
          technique: technique.trim(),
          regions: regions.trim(),
          evolution: evolution.trim(),
          painBefore: painBefore === "" ? null : Number(painBefore),
          painAfter: painAfter === "" ? null : Number(painAfter),
        }
      );
      setSessions((prev) => [created, ...prev]);
      setTechnique("");
      setRegions("");
      setEvolution("");
      setPainBefore("");
      setPainAfter("");
      setShowForm(false);
    } catch {
      setError("Não foi possível registrar a sessão.");
    } finally {
      setSavingSession(false);
    }
  };

  const removeSession = async (id: string) => {
    try {
      await beautyApi.removeMassageSession(establishmentId, clientId, id);
      setSessions((prev) => prev.filter((s) => s._id !== id));
    } catch {
      setError("Não foi possível remover a sessão.");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const authorName = (a: MassageSession["author"]) =>
    typeof a === "object" && a ? a.name : "";

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando massagem...
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm font-medium text-red-500">{error}</p>}

      {savedContra.trim() && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <span aria-hidden="true">⚠️</span>
          <span>Contraindicações: {savedContra}</span>
        </div>
      )}

      {/* avaliacao */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Avaliação</h3>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Queixa principal
            </span>
            <input
              value={mainComplaint}
              onChange={(e) => setMainComplaint(e.target.value)}
              placeholder="Ex: dor lombar, tensão no pescoço..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Pontos de tensão
            </span>
            <input
              value={tensionPoints}
              onChange={(e) => setTensionPoints(e.target.value)}
              placeholder="Ex: trapézio, lombar, cervical..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Contraindicações
            </span>
            <textarea
              value={contraindications}
              onChange={(e) => setContraindications(e.target.value)}
              rows={2}
              placeholder="Gestante, trombose, lesão recente..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Objetivo
            </span>
            <input
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Observações
            </span>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
        </div>
        <button
          onClick={saveAssessment}
          disabled={savingAssessment}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {savingAssessment ? "Salvando..." : "Salvar avaliação"}
        </button>
      </div>

      {/* sessoes */}
      <div className="mt-4 flex items-center justify-between">
        <h3 className="font-display font-bold text-ink">Evolução por sessão</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Nova sessão"}
        </button>
      </div>

      {showForm && (
        <div className="mt-3 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Técnica
              </span>
              <input
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                placeholder="Relaxante, drenagem, desportiva..."
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Regiões trabalhadas
              </span>
              <input
                value={regions}
                onChange={(e) => setRegions(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Dor antes (0–10)
              </span>
              <input
                type="number"
                min={0}
                max={10}
                value={painBefore}
                onChange={(e) => setPainBefore(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Dor depois (0–10)
              </span>
              <input
                type="number"
                min={0}
                max={10}
                value={painAfter}
                onChange={(e) => setPainAfter(e.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Evolução / resposta
            </span>
            <textarea
              value={evolution}
              onChange={(e) => setEvolution(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <button
            onClick={addSession}
            disabled={savingSession}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {savingSession ? "Salvando..." : "Salvar sessão"}
          </button>
        </div>
      )}

      <div className="mt-4">
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            Nenhuma sessão registrada ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s._id}
                className="rounded-xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {s.technique || "Sessão"}
                      {s.regions ? ` · ${s.regions}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {fmtDate(s.date)}
                      {authorName(s.author) ? ` · ${authorName(s.author)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => removeSession(s._id)}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                {(s.painBefore !== null || s.painAfter !== null) && (
                  <p className="mt-2 text-sm text-ink/70">
                    Dor:{" "}
                    <span className="font-medium text-ink">
                      {s.painBefore ?? "—"} → {s.painAfter ?? "—"}
                    </span>
                  </p>
                )}
                {s.evolution && (
                  <p className="mt-1 text-sm text-ink/80">{s.evolution}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
