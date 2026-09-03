import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import {
  podiatryApi,
  PodiatryProfile,
  PodiatrySession,
  Finding,
  Procedure,
  SessionPhoto,
  FootSide,
  FootView,
  ProfilePayload,
  REGIONS,
  CONDITIONS,
  SEVERITIES,
  FOOT_TYPES,
  FOOT_LABELS,
  VIEW_LABELS,
  FOOT_OUTLINE,
  FOOT_TOES,
  regionLabel,
  conditionLabel,
  conditionColor,
} from "../api/podiatry";
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

// ============ ENTRADA: lista de pacientes ============
export function PodologiaManager({
  establishment,
}: {
  establishment: Establishment;
}) {
  const establishmentId = establishment._id;
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
    return patients.filter((s) => s.name.toLowerCase().includes(q));
  }, [patients, query]);

  if (selected) {
    return (
      <PatientPanel
        establishmentId={establishmentId}
        patient={selected}
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
              ? "Nenhum paciente ainda. A ficha fica disponível para quem já teve atendimento aqui."
              : "Nenhum paciente encontrado com esse nome."}
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

// ============ PAINEL DO PACIENTE ============
type PatientView = "ficha" | "atendimentos" | "antesdepois";

function PatientPanel({
  establishmentId,
  patient,
  onBack,
}: {
  establishmentId: string;
  patient: EstablishmentClient;
  onBack: () => void;
}) {
  const clientId = patient._id;
  const [view, setView] = useState<PatientView>("ficha");

  // atendimentos compartilhados entre "atendimentos" e "antes/depois"
  const [sessions, setSessions] = useState<PodiatrySession[]>([]);
  const [loadingS, setLoadingS] = useState(true);
  const [diabetic, setDiabetic] = useState(false);

  useEffect(() => {
    setLoadingS(true);
    podiatryApi
      .listSessions(establishmentId, clientId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadingS(false));
    podiatryApi
      .getProfile(establishmentId, clientId)
      .then((p) => setDiabetic(!!p.diabetic))
      .catch(() => setDiabetic(false));
  }, [establishmentId, clientId]);

  const last = sessions[0];

  const tabs: [PatientView, string][] = [
    ["ficha", "Ficha"],
    ["atendimentos", "Atendimentos"],
    ["antesdepois", "Antes / depois"],
  ];

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:underline"
      >
        ← Voltar aos pacientes
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">
          {patient.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {diabetic && (
            <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
              ⚠ Diabético
            </span>
          )}
          {last && (
            <span className="rounded-full bg-ink/5 px-3 py-1 text-ink/50">
              Último: {fmtDate(last.date)}
            </span>
          )}
        </div>
      </div>

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
          <ProfileSection
            establishmentId={establishmentId}
            clientId={clientId}
            onDiabetic={setDiabetic}
          />
        )}
        {view === "atendimentos" && (
          <SessionsSection
            establishmentId={establishmentId}
            clientId={clientId}
            items={sessions}
            loading={loadingS}
            setItems={setSessions}
          />
        )}
        {view === "antesdepois" && (
          <BeforeAfterGallery items={sessions} loading={loadingS} />
        )}
      </div>
    </div>
  );
}

// ============ FICHA ============
function ProfileSection({
  establishmentId,
  clientId,
  onDiabetic,
}: {
  establishmentId: string;
  clientId: string;
  onDiabetic?: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [mainComplaint, setMainComplaint] = useState("");
  const [diabetic, setDiabetic] = useState(false);
  const [circulationNotes, setCirculationNotes] = useState("");
  const [footType, setFootType] = useState("");
  const [footwear, setFootwear] = useState("");
  const [allergies, setAllergies] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [photos, setPhotos] = useState<
    { url: string; date: string; note: string }[]
  >([]);

  useEffect(() => {
    setLoading(true);
    podiatryApi
      .getProfile(establishmentId, clientId)
      .then((p: PodiatryProfile) => {
        setMainComplaint(p.mainComplaint || "");
        setDiabetic(!!p.diabetic);
        setCirculationNotes(p.circulationNotes || "");
        setFootType(p.footType || "");
        setFootwear(p.footwear || "");
        setAllergies(p.allergies || "");
        setHealthNotes(p.healthNotes || "");
        setPhotos(
          (p.photos || []).map((ph) => ({
            url: ph.url,
            date: ph.date
              ? toDateInput(new Date(ph.date))
              : toDateInput(new Date()),
            note: ph.note || "",
          }))
        );
      })
      .catch(() => setError("Não foi possível carregar a ficha."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

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
      const payload: ProfilePayload = {
        mainComplaint: mainComplaint.trim(),
        diabetic,
        circulationNotes: circulationNotes.trim(),
        footType,
        footwear: footwear.trim(),
        allergies: allergies.trim(),
        healthNotes: healthNotes.trim(),
        photos: photos.map((p) => ({
          url: p.url,
          date: p.date || undefined,
          note: p.note.trim(),
        })),
      };
      await podiatryApi.updateProfile(establishmentId, clientId, payload);
      onDiabetic?.(diabetic);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch {
      setError("Não foi possível salvar a ficha.");
    } finally {
      setSaving(false);
    }
  };

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
        <label className="block">
          <span className={lbl}>Queixa principal</span>
          <textarea
            value={mainComplaint}
            onChange={(e) => setMainComplaint(e.target.value)}
            rows={2}
            placeholder="Ex: dor ao caminhar, unha encravada no hálux direito, calosidades..."
            className={area}
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-ink/10 bg-sand/40 px-3 py-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={diabetic}
              onChange={(e) => setDiabetic(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            Paciente diabético (cuidado redobrado)
          </label>
          <label className="block">
            <span className={lbl}>Tipo de pisada / pé</span>
            <select
              value={footType}
              onChange={(e) => setFootType(e.target.value)}
              className={input}
            >
              <option value="">Não informado</option>
              {FOOT_TYPES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {diabetic && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <span aria-hidden="true">⚠️</span>
            <span>
              Pé diabético: redobre a atenção com cortes, fissuras e feridas — o
              risco de complicação é maior.
            </span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <label className="block">
          <span className={lbl}>Circulação / vascular</span>
          <textarea
            value={circulationNotes}
            onChange={(e) => setCirculationNotes(e.target.value)}
            rows={2}
            placeholder="Ex: varizes, edema, extremidades frias, histórico vascular"
            className={area}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Calçado habitual / atividade</span>
          <input
            value={footwear}
            onChange={(e) => setFootwear(e.target.value)}
            placeholder="Ex: salto alto no trabalho, corrida 3x/semana, sapato apertado"
            className={input}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Alergias</span>
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="Ex: esparadrapo, anestésico tópico, iodo"
            className={input}
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

      {/* fotos de referência */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Fotos de referência</h3>
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
                  placeholder="Legenda"
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
            folder="podologia"
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

// ============ MAPA DO PÉ (SVG) ============
function FootSvg({
  foot,
  findings,
  selectedRegion,
  onPick,
}: {
  foot: FootSide;
  findings: Finding[];
  selectedRegion: string | null;
  onPick: (region: string) => void;
}) {
  const byRegion: Record<string, Finding[]> = {};
  findings.forEach((f) => (byRegion[f.region] = [...(byRegion[f.region] || []), f]));

  return (
    <div className="flex flex-col items-center">
      <span className="mb-1 text-xs font-semibold text-ink/60">
        {FOOT_LABELS[foot]}
      </span>
      <svg
        viewBox="0 0 120 270"
        className="h-auto w-full max-w-[140px]"
        role="img"
        aria-label={`Mapa do ${FOOT_LABELS[foot]}`}
      >
        <path
          d={FOOT_OUTLINE}
          fill="#f5f3ef"
          stroke="#cbd5e1"
          strokeWidth={2}
        />
        {FOOT_TOES.map((t, i) => (
          <circle
            key={i}
            cx={t.cx}
            cy={t.cy}
            r={t.r}
            fill="#f5f3ef"
            stroke="#cbd5e1"
            strokeWidth={2}
          />
        ))}
        {REGIONS.map((r) => {
          const list = byRegion[r.key] || [];
          const isSel = selectedRegion === r.key;
          return (
            <g
              key={r.key}
              onClick={() => onPick(r.key)}
              style={{ cursor: "pointer" }}
            >
              {/* área de toque */}
              <circle
                cx={r.cx}
                cy={r.cy}
                r={14}
                fill="transparent"
                stroke={isSel ? "#14b8a6" : "transparent"}
                strokeWidth={2}
              />
              {list.length === 0 ? (
                <circle
                  cx={r.cx}
                  cy={r.cy}
                  r={3}
                  fill="#94a3b8"
                  opacity={0.5}
                />
              ) : (
                <>
                  <circle
                    cx={r.cx}
                    cy={r.cy}
                    r={7.5}
                    fill={conditionColor(list[0].condition)}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                  {list.length > 1 && (
                    <text
                      x={r.cx}
                      y={r.cy + 3}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight="bold"
                      fill="#fff"
                    >
                      {list.length}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============ ATENDIMENTOS (mapa + procedimentos + antes/depois) ============
const emptyProcedure = (): Procedure => ({
  name: "",
  region: "",
  materials: "",
  note: "",
});

interface SessionForm {
  date: string;
  nextVisit: string;
  findings: Finding[];
  procedures: Procedure[];
  beforePhotos: SessionPhoto[];
  afterPhotos: SessionPhoto[];
  recommendations: string;
  notes: string;
}
const emptySessionForm = (): SessionForm => ({
  date: toDateInput(new Date()),
  nextVisit: "",
  findings: [],
  procedures: [],
  beforePhotos: [],
  afterPhotos: [],
  recommendations: "",
  notes: "",
});

function SessionsSection({
  establishmentId,
  clientId,
  items,
  loading,
  setItems,
}: {
  establishmentId: string;
  clientId: string;
  items: PodiatrySession[];
  loading: boolean;
  setItems: React.Dispatch<React.SetStateAction<PodiatrySession[]>>;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SessionForm>(emptySessionForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  // estado do mapa
  const [view, setView] = useState<FootView>("dorsal");
  const [sel, setSel] = useState<{ foot: FootSide; region: string } | null>(
    null
  );
  const [addForm, setAddForm] = useState({
    condition: CONDITIONS[0].key,
    severity: "leve",
    note: "",
  });

  const openNew = () => {
    setForm(emptySessionForm());
    setEditing("new");
    setSel(null);
    setView("dorsal");
    setError(null);
  };
  const openEdit = (s: PodiatrySession) => {
    setForm({
      date: toDateInput(new Date(s.date)),
      nextVisit: s.nextVisit ? toDateInput(new Date(s.nextVisit)) : "",
      findings: s.findings.map((f) => ({ ...f })),
      procedures: s.procedures.map((p) => ({ ...p })),
      beforePhotos: s.beforePhotos.map((p) => ({ ...p })),
      afterPhotos: s.afterPhotos.map((p) => ({ ...p })),
      recommendations: s.recommendations || "",
      notes: s.notes || "",
    });
    setEditing(s._id);
    setSel(null);
    setView("dorsal");
    setError(null);
  };
  const cancel = () => {
    setEditing(null);
    setForm(emptySessionForm());
    setSel(null);
  };

  // ---- mapa: adicionar / remover achados ----
  const addFinding = () => {
    if (!sel) return;
    const f: Finding = {
      foot: sel.foot,
      view,
      region: sel.region,
      condition: addForm.condition,
      severity: addForm.severity,
      note: addForm.note.trim(),
    };
    setForm((prev) => ({ ...prev, findings: [...prev.findings, f] }));
    setAddForm((a) => ({ ...a, note: "" }));
  };
  const removeFinding = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      findings: prev.findings.filter((_, i) => i !== idx),
    }));

  // ---- procedimentos ----
  const addProcedure = () =>
    setForm((prev) => ({
      ...prev,
      procedures: [...prev.procedures, emptyProcedure()],
    }));
  const setProcedure = (i: number, k: keyof Procedure, v: string) =>
    setForm((prev) => {
      const procedures = [...prev.procedures];
      procedures[i] = { ...procedures[i], [k]: v };
      return { ...prev, procedures };
    });
  const removeProcedure = (i: number) =>
    setForm((prev) => ({
      ...prev,
      procedures: prev.procedures.filter((_, idx) => idx !== i),
    }));

  // ---- fotos antes/depois ----
  const addPhoto = (which: "beforePhotos" | "afterPhotos", url: string) => {
    if (!url) return;
    setForm((prev) => ({
      ...prev,
      [which]: [...prev[which], { url, note: "" }],
    }));
  };
  const removePhoto = (which: "beforePhotos" | "afterPhotos", url: string) => {
    setForm((prev) => ({
      ...prev,
      [which]: prev[which].filter((p) => p.url !== url),
    }));
    void deleteUploadByUrl(url);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      date: form.date || undefined,
      findings: form.findings,
      procedures: form.procedures.filter((p) => p.name.trim() !== ""),
      beforePhotos: form.beforePhotos,
      afterPhotos: form.afterPhotos,
      recommendations: form.recommendations.trim(),
      notes: form.notes.trim(),
      nextVisit: form.nextVisit || null,
    };
    try {
      if (editing && editing !== "new") {
        const updated = await podiatryApi.updateSession(
          establishmentId,
          clientId,
          editing,
          payload
        );
        setItems((list) =>
          list
            .map((x) => (x._id === editing ? updated : x))
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );
      } else {
        const created = await podiatryApi.createSession(
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
      setError("Não foi possível salvar o atendimento.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: PodiatrySession) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== s._id));
    try {
      await podiatryApi.removeSession(establishmentId, clientId, s._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover o atendimento.");
    }
  };

  const downloadPdf = async (s: PodiatrySession) => {
    setPdfBusy(s._id);
    try {
      const blob = await podiatryApi.sessionPdf(establishmentId, clientId, s._id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("Não foi possível gerar o PDF.");
    } finally {
      setPdfBusy(null);
    }
  };

  // ---- formulário ----
  if (editing) {
    const viewFindings = form.findings.filter((f) => f.view === view);
    const selList = sel
      ? form.findings.filter(
          (f) => f.foot === sel.foot && f.view === view && f.region === sel.region
        )
      : [];
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <label className="block sm:max-w-xs">
            <span className={lbl}>Data do atendimento</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={input}
            />
          </label>
        </div>

        {/* ---- MAPA DO PÉ ---- */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display font-bold text-ink">Mapa do pé</h3>
            <div className="inline-flex rounded-lg border border-ink/15 p-0.5">
              {(["dorsal", "plantar"] as FootView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setView(v);
                    setSel(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    view === v
                      ? "bg-teal-500 text-white"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          <p className="mb-3 text-xs text-ink/50">
            Toque em uma região do pé para registrar um achado (calo, micose,
            unha encravada…). Vista atual:{" "}
            <span className="font-medium text-ink/70">{VIEW_LABELS[view]}</span>.
          </p>

          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            {(["left", "right"] as FootSide[]).map((foot) => (
              <FootSvg
                key={foot}
                foot={foot}
                findings={viewFindings.filter((f) => f.foot === foot)}
                selectedRegion={
                  sel && sel.foot === foot ? sel.region : null
                }
                onPick={(region) => setSel({ foot, region })}
              />
            ))}
          </div>

          {/* legenda */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {CONDITIONS.map((c) => (
              <span
                key={c.key}
                className="flex items-center gap-1.5 text-xs text-ink/60"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </span>
            ))}
          </div>

          {/* adicionar achado na região selecionada */}
          {sel && (
            <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
              <p className="mb-3 text-sm font-semibold text-ink">
                {regionLabel(sel.region)} — {FOOT_LABELS[sel.foot]} (
                {VIEW_LABELS[view]})
              </p>

              {selList.length > 0 && (
                <div className="mb-3 space-y-1">
                  {selList.map((f) => {
                    const gi = form.findings.indexOf(f);
                    return (
                      <div
                        key={gi}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor: conditionColor(f.condition),
                            }}
                          />
                          {conditionLabel(f.condition)}
                          {f.severity ? ` · ${f.severity}` : ""}
                          {f.note ? (
                            <span className="text-ink/50">— {f.note}</span>
                          ) : null}
                        </span>
                        <button
                          onClick={() => removeFinding(gi)}
                          className="text-red-500 hover:underline"
                        >
                          remover
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className={lbl}>Achado</span>
                  <select
                    value={addForm.condition}
                    onChange={(e) =>
                      setAddForm((a) => ({ ...a, condition: e.target.value }))
                    }
                    className={input}
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={lbl}>Gravidade</span>
                  <select
                    value={addForm.severity}
                    onChange={(e) =>
                      setAddForm((a) => ({ ...a, severity: e.target.value }))
                    }
                    className={input}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={lbl}>Detalhe (opcional)</span>
                  <input
                    value={addForm.note}
                    onChange={(e) =>
                      setAddForm((a) => ({ ...a, note: e.target.value }))
                    }
                    className={input}
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={addFinding}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
                >
                  Adicionar achado
                </button>
                <button
                  onClick={() => setSel(null)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink/60 hover:underline"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* resumo de todos os achados */}
          {form.findings.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold text-ink/60">
                Achados registrados ({form.findings.length})
              </p>
              <div className="space-y-1">
                {form.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: conditionColor(f.condition) }}
                      />
                      <span className="text-ink/80">
                        {conditionLabel(f.condition)}
                      </span>
                      <span className="text-ink/50">
                        {regionLabel(f.region)} · {FOOT_LABELS[f.foot]} ·{" "}
                        {VIEW_LABELS[f.view]}
                        {f.severity ? ` · ${f.severity}` : ""}
                      </span>
                    </span>
                    <button
                      onClick={() => removeFinding(i)}
                      className="text-red-500 hover:underline"
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---- PROCEDIMENTOS ---- */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-bold text-ink">
              Procedimentos realizados
            </h3>
          </div>
          {form.procedures.length === 0 && (
            <p className="text-sm text-ink/50">
              Nenhum procedimento adicionado.
            </p>
          )}
          <div className="space-y-2">
            {form.procedures.map((p, i) => (
              <div
                key={i}
                className="rounded-xl border border-ink/10 bg-sand/40 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-12">
                  <input
                    value={p.name}
                    onChange={(e) => setProcedure(i, "name", e.target.value)}
                    placeholder="Procedimento (ex: remoção de calosidade)"
                    className={`${input} sm:col-span-6`}
                  />
                  <input
                    value={p.region}
                    onChange={(e) => setProcedure(i, "region", e.target.value)}
                    placeholder="Região (ex: hálux D)"
                    className={`${input} sm:col-span-3`}
                  />
                  <div className="flex sm:col-span-3">
                    <button
                      onClick={() => removeProcedure(i)}
                      className="h-10 w-full rounded-lg border border-ink/15 text-sm font-medium text-red-500 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    value={p.materials}
                    onChange={(e) =>
                      setProcedure(i, "materials", e.target.value)
                    }
                    placeholder="Materiais / produtos"
                    className={input}
                  />
                  <input
                    value={p.note}
                    onChange={(e) => setProcedure(i, "note", e.target.value)}
                    placeholder="Observação / técnica"
                    className={input}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addProcedure}
            className="mt-3 text-sm font-semibold text-teal-600 hover:underline"
          >
            + Adicionar procedimento
          </button>
        </div>

        {/* ---- ANTES / DEPOIS ---- */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-display font-bold text-ink">Antes / depois</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <PhotoColumn
              title="Antes"
              photos={form.beforePhotos}
              onAdd={(url) => addPhoto("beforePhotos", url)}
              onRemove={(url) => removePhoto("beforePhotos", url)}
            />
            <PhotoColumn
              title="Depois"
              photos={form.afterPhotos}
              onAdd={(url) => addPhoto("afterPhotos", url)}
              onRemove={(url) => removePhoto("afterPhotos", url)}
            />
          </div>
        </div>

        {/* ---- notas ---- */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <label className="block">
            <span className={lbl}>Orientações ao paciente</span>
            <textarea
              value={form.recommendations}
              onChange={(e) =>
                setForm((f) => ({ ...f, recommendations: e.target.value }))
              }
              rows={2}
              placeholder="Ex: hidratar os pés diariamente, evitar sapato apertado, retornar em 30 dias"
              className={area}
            />
          </label>
          <label className="mt-3 block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              className={area}
            />
          </label>
        </div>

        {/* proxima visita — agenda direto na agenda do estabelecimento */}
        <ReturnScheduler
          establishmentId={establishmentId}
          clientId={clientId}
          title="Próxima visita"
          hint="Selecione o dia e um horário livre — o retorno é agendado direto na sua agenda para este paciente."
          onScheduled={(iso) => setForm((f) => ({ ...f, nextVisit: iso }))}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={saving}
            className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar atendimento"}
          </button>
          <button
            onClick={cancel}
            className="h-11 rounded-xl px-4 text-sm font-medium text-ink/60 hover:underline"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ---- lista de atendimentos ----
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Registre cada atendimento com o mapa do pé, os procedimentos e as
          fotos de antes/depois.
        </p>
        <button
          onClick={openNew}
          className="shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Novo atendimento
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
          Carregando atendimentos...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum atendimento registrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const hasBA =
              s.beforePhotos.length > 0 || s.afterPhotos.length > 0;
            return (
              <div
                key={s._id}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{fmtDate(s.date)}</p>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      onClick={() => downloadPdf(s)}
                      disabled={pdfBusy === s._id}
                      className="font-medium text-teal-600 hover:underline disabled:opacity-50"
                    >
                      {pdfBusy === s._id ? "Gerando..." : "PDF"}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => remove(s)}
                      className="font-medium text-red-500 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/70">
                    {s.findings.length} achado
                    {s.findings.length !== 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/70">
                    {s.procedures.length} procedimento
                    {s.procedures.length !== 1 ? "s" : ""}
                  </span>
                  {hasBA && (
                    <span className="rounded-full bg-teal-500/10 px-2.5 py-1 font-medium text-teal-600">
                      Antes/depois
                    </span>
                  )}
                  {s.nextVisit && (
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/50">
                      Retorno: {fmtDate(s.nextVisit)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhotoColumn({
  title,
  photos,
  onAdd,
  onRemove,
}: {
  title: string;
  photos: SessionPhoto[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
      <p className="mb-2 text-sm font-semibold text-ink/70">{title}</p>
      {photos.length > 0 && (
        <div className="mb-2 grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <div key={p.url} className="relative">
              <img
                src={p.url}
                alt=""
                className="h-24 w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(p.url)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                aria-label="Remover foto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <ImageUpload
        value=""
        onChange={onAdd}
        folder="podologia"
        label=""
        hint=""
      />
    </div>
  );
}

// ============ ANTES / DEPOIS (galeria) ============
function BeforeAfterGallery({
  items,
  loading,
}: {
  items: PodiatrySession[];
  loading: boolean;
}) {
  const withPhotos = items.filter(
    (s) => s.beforePhotos.length > 0 || s.afterPhotos.length > 0
  );

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando...
      </div>
    );

  if (withPhotos.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
        Adicione fotos de antes/depois nos atendimentos para ver a galeria
        aqui.
      </div>
    );

  return (
    <div className="space-y-4">
      {withPhotos.map((s) => (
        <div key={s._id} className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="mb-3 font-semibold text-ink">{fmtDate(s.date)}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
                Antes
              </p>
              {s.beforePhotos.length === 0 ? (
                <p className="text-sm text-ink/40">—</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {s.beforePhotos.map((p, i) => (
                    <img
                      key={i}
                      src={p.url}
                      alt="Antes"
                      className="h-32 w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
                Depois
              </p>
              {s.afterPhotos.length === 0 ? (
                <p className="text-sm text-ink/40">—</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {s.afterPhotos.map((p, i) => (
                    <img
                      key={i}
                      src={p.url}
                      alt="Depois"
                      className="h-32 w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
