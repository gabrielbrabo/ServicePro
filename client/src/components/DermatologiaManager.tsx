import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import {
  dermatologyApi,
  DermatologyProfile,
  DermatologySession,
  Finding,
  SessionPhoto,
  BodyView,
  ProfilePayload,
  REGIONS,
  LESION_TYPES,
  ABCDE_ITEMS,
  PHOTOTYPES,
  VIEW_LABELS,
  BODY,
  regionLabel,
  lesionLabel,
  lesionColor,
} from "../api/dermatology";
import { ImageUpload } from "./ImageUpload";
import { deleteUploadByUrl } from "../api/upload";
import { ReturnScheduler } from "./ReturnScheduler";

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
const primaryBtn =
  "h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60";

// ============ ENTRADA: lista de pacientes ============
export function DermatologiaManager({
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
type PatientView = "ficha" | "atendimentos" | "regiao" | "antesdepois";

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
  const [sessions, setSessions] = useState<DermatologySession[]>([]);
  const [loadingS, setLoadingS] = useState(true);

  useEffect(() => {
    setLoadingS(true);
    dermatologyApi
      .listSessions(establishmentId, clientId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadingS(false));
  }, [establishmentId, clientId]);

  const last = sessions[0];

  const tabs: [PatientView, string][] = [
    ["ficha", "Ficha"],
    ["atendimentos", "Atendimentos"],
    ["regiao", "Por região"],
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
        {last && (
          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/50">
            Último: {fmtDate(last.date)}
          </span>
        )}
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
          <ProfileSection establishmentId={establishmentId} clientId={clientId} />
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
        {view === "regiao" && (
          <ByRegionSection items={sessions} loading={loadingS} />
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
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [f, setF] = useState({
    phototype: "",
    mainComplaint: "",
    skinCancerHistory: "",
    sunExposure: "",
    allergies: "",
    medications: "",
    healthNotes: "",
  });
  const [photos, setPhotos] = useState<
    { url: string; date: string; note: string }[]
  >([]);

  useEffect(() => {
    setLoading(true);
    dermatologyApi
      .getProfile(establishmentId, clientId)
      .then((p: DermatologyProfile) => {
        setF({
          phototype: p.phototype || "",
          mainComplaint: p.mainComplaint || "",
          skinCancerHistory: p.skinCancerHistory || "",
          sunExposure: p.sunExposure || "",
          allergies: p.allergies || "",
          medications: p.medications || "",
          healthNotes: p.healthNotes || "",
        });
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

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const addPhoto = (url: string) => {
    if (url)
      setPhotos((l) => [...l, { url, date: toDateInput(new Date()), note: "" }]);
  };
  const removePhoto = (url: string) => {
    setPhotos((l) => l.filter((p) => p.url !== url));
    void deleteUploadByUrl(url);
  };
  const setPhotoField = (url: string, k: "date" | "note", v: string) =>
    setPhotos((l) => l.map((p) => (p.url === url ? { ...p, [k]: v } : p)));

  const save = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const payload: ProfilePayload = {
        phototype: f.phototype,
        mainComplaint: f.mainComplaint.trim(),
        skinCancerHistory: f.skinCancerHistory.trim(),
        sunExposure: f.sunExposure.trim(),
        allergies: f.allergies.trim(),
        medications: f.medications.trim(),
        healthNotes: f.healthNotes.trim(),
        photos: photos.map((p) => ({
          url: p.url,
          date: p.date || undefined,
          note: p.note.trim(),
        })),
      };
      await dermatologyApi.updateProfile(establishmentId, clientId, payload);
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Fototipo (Fitzpatrick)</span>
            <select
              value={f.phototype}
              onChange={(e) => set("phototype", e.target.value)}
              className={input}
            >
              <option value="">Não informado</option>
              {PHOTOTYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={lbl}>Queixa principal</span>
            <input
              value={f.mainComplaint}
              onChange={(e) => set("mainComplaint", e.target.value)}
              placeholder="Ex: acompanhamento de pintas, mancha nova no braço"
              className={input}
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className={lbl}>Antecedentes de câncer de pele</span>
          <textarea
            value={f.skinCancerHistory}
            onChange={(e) => set("skinCancerHistory", e.target.value)}
            rows={2}
            placeholder="Pessoais e familiares (melanoma, CBC, CEC...)"
            className={area}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Exposição solar / fotoproteção</span>
            <textarea
              value={f.sunExposure}
              onChange={(e) => set("sunExposure", e.target.value)}
              rows={2}
              placeholder="Ex: trabalho ao ar livre, uso de FPS 50"
              className={area}
            />
          </label>
          <label className="block">
            <span className={lbl}>Medicações em uso</span>
            <textarea
              value={f.medications}
              onChange={(e) => set("medications", e.target.value)}
              rows={2}
              className={area}
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className={lbl}>Alergias</span>
          <input
            value={f.allergies}
            onChange={(e) => set("allergies", e.target.value)}
            className={input}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Observações</span>
          <textarea
            value={f.healthNotes}
            onChange={(e) => set("healthNotes", e.target.value)}
            rows={3}
            className={area}
          />
        </label>
      </div>

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
            folder="dermatologia"
            label=""
            hint="Adicione uma foto por vez."
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={primaryBtn}>
          {saving ? "Salvando..." : "Salvar ficha"}
        </button>
        {ok && <span className="text-sm font-medium text-teal-600">Salvo!</span>}
      </div>
    </div>
  );
}

// ============ MAPA DO CORPO (SVG) ============
function BodySvg({
  findings,
  selectedRegion,
  onPick,
}: {
  findings: Finding[]; // já filtrados para a vista atual
  selectedRegion: string | null;
  onPick: (region: string) => void;
}) {
  const byRegion: Record<string, Finding[]> = {};
  findings.forEach(
    (f) => (byRegion[f.region] = [...(byRegion[f.region] || []), f])
  );

  return (
    <svg
      viewBox="0 0 120 300"
      className="mx-auto h-auto w-full max-w-[190px]"
      role="img"
      aria-label="Mapa do corpo"
    >
      {/* membros (atrás) */}
      {BODY.limbs.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#e4e1d9"
          strokeWidth={14}
          strokeLinecap="round"
        />
      ))}
      <rect
        x={BODY.neck.x}
        y={BODY.neck.y}
        width={BODY.neck.w}
        height={BODY.neck.h}
        fill="#f5f3ef"
        stroke="#cbd5e1"
        strokeWidth={1.5}
      />
      <path d={BODY.torso} fill="#f5f3ef" stroke="#cbd5e1" strokeWidth={2} />
      <circle
        cx={BODY.head.cx}
        cy={BODY.head.cy}
        r={BODY.head.r}
        fill="#f5f3ef"
        stroke="#cbd5e1"
        strokeWidth={2}
      />
      {REGIONS.map((r) => {
        const list = byRegion[r.key] || [];
        const isSel = selectedRegion === r.key;
        return (
          <g
            key={r.key}
            onClick={() => onPick(r.key)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={r.cx}
              cy={r.cy}
              r={11}
              fill="transparent"
              stroke={isSel ? "#14b8a6" : "transparent"}
              strokeWidth={2}
            />
            {list.length === 0 ? (
              <circle cx={r.cx} cy={r.cy} r={2.5} fill="#94a3b8" opacity={0.5} />
            ) : (
              <>
                <circle
                  cx={r.cx}
                  cy={r.cy}
                  r={6.5}
                  fill={lesionColor(list[0].type)}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
                {list.length > 1 && (
                  <text
                    x={r.cx}
                    y={r.cy + 3}
                    textAnchor="middle"
                    fontSize={7.5}
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
  );
}

// ============ ATENDIMENTOS ============
interface SessionForm {
  date: string;
  nextVisit: string;
  findings: Finding[];
  beforePhotos: SessionPhoto[];
  afterPhotos: SessionPhoto[];
  recommendations: string;
  notes: string;
}
const emptySessionForm = (): SessionForm => ({
  date: toDateInput(new Date()),
  nextVisit: "",
  findings: [],
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
  items: DermatologySession[];
  loading: boolean;
  setItems: React.Dispatch<React.SetStateAction<DermatologySession[]>>;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SessionForm>(emptySessionForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<BodyView>("front");
  const [sel, setSel] = useState<string | null>(null); // região selecionada
  const [addForm, setAddForm] = useState({
    type: LESION_TYPES[0].key,
    size: "",
    color: "",
    abcde: [] as string[],
    note: "",
  });

  const resetAdd = () =>
    setAddForm({ type: LESION_TYPES[0].key, size: "", color: "", abcde: [], note: "" });

  const openNew = () => {
    setForm(emptySessionForm());
    setEditing("new");
    setSel(null);
    setView("front");
    resetAdd();
    setError(null);
  };
  const openEdit = (s: DermatologySession) => {
    setForm({
      date: toDateInput(new Date(s.date)),
      nextVisit: s.nextVisit ? toDateInput(new Date(s.nextVisit)) : "",
      findings: s.findings.map((f) => ({ ...f, abcde: [...(f.abcde || [])] })),
      beforePhotos: s.beforePhotos.map((p) => ({ ...p })),
      afterPhotos: s.afterPhotos.map((p) => ({ ...p })),
      recommendations: s.recommendations || "",
      notes: s.notes || "",
    });
    setEditing(s._id);
    setSel(null);
    setView("front");
    resetAdd();
    setError(null);
  };
  const cancel = () => {
    setEditing(null);
    setForm(emptySessionForm());
    setSel(null);
  };

  const toggleAbcde = (k: string) =>
    setAddForm((a) => ({
      ...a,
      abcde: a.abcde.includes(k)
        ? a.abcde.filter((x) => x !== k)
        : [...a.abcde, k],
    }));

  const addFinding = () => {
    if (!sel) return;
    const f: Finding = {
      region: sel,
      view,
      type: addForm.type,
      size: Number(addForm.size) || 0,
      color: addForm.color.trim(),
      abcde: addForm.abcde,
      note: addForm.note.trim(),
    };
    setForm((prev) => ({ ...prev, findings: [...prev.findings, f] }));
    resetAdd();
  };
  const removeFinding = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      findings: prev.findings.filter((_, i) => i !== idx),
    }));

  const addPhoto = (which: "beforePhotos" | "afterPhotos", url: string) => {
    if (!url) return;
    setForm((prev) => ({ ...prev, [which]: [...prev[which], { url, note: "" }] }));
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
      beforePhotos: form.beforePhotos,
      afterPhotos: form.afterPhotos,
      recommendations: form.recommendations.trim(),
      notes: form.notes.trim(),
      nextVisit: form.nextVisit || null,
    };
    try {
      if (editing && editing !== "new") {
        const updated = await dermatologyApi.updateSession(
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
        const created = await dermatologyApi.createSession(
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

  const remove = async (s: DermatologySession) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== s._id));
    try {
      await dermatologyApi.removeSession(establishmentId, clientId, s._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover o atendimento.");
    }
  };

  if (editing) {
    const viewFindings = form.findings.filter((f) => f.view === view);
    const selList = sel
      ? form.findings.filter((f) => f.view === view && f.region === sel)
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

        {/* ---- MAPA DO CORPO ---- */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display font-bold text-ink">
              Mapa de lesões / pintas
            </h3>
            <div className="inline-flex rounded-lg border border-ink/15 p-0.5">
              {(["front", "back"] as BodyView[]).map((v) => (
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
            Toque em uma região do corpo para registrar uma lesão. Vista atual:{" "}
            <span className="font-medium text-ink/70">{VIEW_LABELS[view]}</span>.
          </p>

          <BodySvg
            findings={viewFindings}
            selectedRegion={sel}
            onPick={(region) => setSel(region)}
          />

          {/* legenda */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {LESION_TYPES.map((t) => (
              <span
                key={t.key}
                className="flex items-center gap-1.5 text-xs text-ink/60"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.label}
              </span>
            ))}
          </div>

          {/* adicionar lesão na região selecionada */}
          {sel && (
            <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
              <p className="mb-3 text-sm font-semibold text-ink">
                {regionLabel(sel)} · {VIEW_LABELS[view]}
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
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: lesionColor(f.type) }}
                          />
                          {lesionLabel(f.type)}
                          {f.size ? ` · ${f.size} mm` : ""}
                          {f.color ? ` · ${f.color}` : ""}
                          {f.abcde.length > 0 ? (
                            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700">
                              ABCDE: {f.abcde.join("")}
                            </span>
                          ) : null}
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
                  <span className={lbl}>Tipo</span>
                  <select
                    value={addForm.type}
                    onChange={(e) =>
                      setAddForm((a) => ({ ...a, type: e.target.value }))
                    }
                    className={input}
                  >
                    {LESION_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={lbl}>Tamanho (mm)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={addForm.size}
                    onChange={(e) =>
                      setAddForm((a) => ({ ...a, size: e.target.value }))
                    }
                    className={input}
                  />
                </label>
                <label className="block">
                  <span className={lbl}>Cor</span>
                  <input
                    value={addForm.color}
                    onChange={(e) =>
                      setAddForm((a) => ({ ...a, color: e.target.value }))
                    }
                    placeholder="Ex: castanha, enegrecida"
                    className={input}
                  />
                </label>
              </div>

              <div className="mt-3">
                <span className={lbl}>Critérios ABCDE (melanoma)</span>
                <div className="flex flex-wrap gap-2">
                  {ABCDE_ITEMS.map((it) => {
                    const on = addForm.abcde.includes(it.key);
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => toggleAbcde(it.key)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          on
                            ? "border-violet-500 bg-violet-500 text-white"
                            : "border-ink/15 text-ink/60 hover:border-violet-400"
                        }`}
                        title={it.label}
                      >
                        {it.key} · {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="mt-3 block">
                <span className={lbl}>Descrição / conduta</span>
                <input
                  value={addForm.note}
                  onChange={(e) =>
                    setAddForm((a) => ({ ...a, note: e.target.value }))
                  }
                  className={input}
                />
              </label>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={addFinding}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
                >
                  Adicionar lesão
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

          {/* resumo de todas as lesões */}
          {form.findings.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold text-ink/60">
                Lesões registradas ({form.findings.length})
              </p>
              <div className="space-y-1">
                {form.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-1.5 text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: lesionColor(f.type) }}
                      />
                      <span className="text-ink/80">{lesionLabel(f.type)}</span>
                      <span className="text-ink/50">
                        {regionLabel(f.region)} · {VIEW_LABELS[f.view]}
                        {f.size ? ` · ${f.size} mm` : ""}
                        {f.abcde.length ? ` · ABCDE ${f.abcde.join("")}` : ""}
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
              placeholder="Ex: fotoproteção diária, retorno para reavaliar pinta do dorso"
              className={area}
            />
          </label>
          <label className="mt-3 block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={area}
            />
          </label>
        </div>

        {/* ---- próxima visita: agenda direto na agenda ---- */}
        <ReturnScheduler
          establishmentId={establishmentId}
          clientId={clientId}
          title="Próxima visita"
          hint="Selecione o dia e um horário livre — o retorno é agendado direto na sua agenda para este paciente."
          onScheduled={(iso) => setForm((f) => ({ ...f, nextVisit: iso }))}
        />

        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={saving} className={primaryBtn}>
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

  // ---- lista ----
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Cada atendimento registra o mapa de lesões, as fotos de antes/depois e
          a próxima visita.
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
            const suspeitas = s.findings.filter(
              (f) => f.type === "suspeita" || (f.abcde && f.abcde.length >= 3)
            ).length;
            return (
              <div
                key={s._id}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{fmtDate(s.date)}</p>
                  <div className="flex items-center gap-3 text-sm">
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
                    {s.findings.length} lesã
                    {s.findings.length !== 1 ? "es" : "o"}
                  </span>
                  {suspeitas > 0 && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700">
                      {suspeitas} suspeita{suspeitas !== 1 ? "s" : ""}
                    </span>
                  )}
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
      <ImageUpload value="" onChange={onAdd} folder="dermatologia" label="" hint="" />
    </div>
  );
}

// ============ POR REGIÃO (acompanhamento) ============
function ByRegionSection({
  items,
  loading,
}: {
  items: DermatologySession[];
  loading: boolean;
}) {
  // agrupa todas as lesões (de todos os atendimentos) por região, com a data
  const byRegion = useMemo(() => {
    const map: Record<
      string,
      { date: string; view: BodyView; f: Finding }[]
    > = {};
    [...items]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((s) => {
        s.findings.forEach((f) => {
          (map[f.region] = map[f.region] || []).push({
            date: s.date,
            view: f.view,
            f,
          });
        });
      });
    return map;
  }, [items]);

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando...
      </div>
    );

  const regionsWith = REGIONS.filter((r) => byRegion[r.key]?.length);
  if (regionsWith.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
        Registre lesões nos atendimentos para acompanhar a evolução por região.
      </div>
    );

  return (
    <div className="space-y-3">
      {regionsWith.map((r) => (
        <div key={r.key} className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="font-display font-bold text-ink">{r.label}</p>
          <div className="mt-2 space-y-1">
            {byRegion[r.key].map((row, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 border-b border-ink/5 pb-1 text-sm last:border-0"
              >
                <span className="w-20 shrink-0 text-xs text-ink/50">
                  {fmtDate(row.date)}
                </span>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: lesionColor(row.f.type) }}
                />
                <span className="text-ink/80">{lesionLabel(row.f.type)}</span>
                <span className="text-ink/50">
                  {VIEW_LABELS[row.view]}
                  {row.f.size ? ` · ${row.f.size} mm` : ""}
                  {row.f.color ? ` · ${row.f.color}` : ""}
                  {row.f.abcde.length ? ` · ABCDE ${row.f.abcde.join("")}` : ""}
                </span>
                {row.f.note && (
                  <span className="text-ink/60">— {row.f.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ ANTES / DEPOIS ============
function BeforeAfterGallery({
  items,
  loading,
}: {
  items: DermatologySession[];
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
        Adicione fotos de antes/depois nos atendimentos para ver a galeria aqui.
      </div>
    );

  return (
    <div className="space-y-4">
      {withPhotos.map((s) => (
        <div key={s._id} className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="mb-3 font-semibold text-ink">{fmtDate(s.date)}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["beforePhotos", "afterPhotos"] as const).map((k) => (
              <div key={k}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
                  {k === "beforePhotos" ? "Antes" : "Depois"}
                </p>
                {s[k].length === 0 ? (
                  <p className="text-sm text-ink/40">—</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {s[k].map((p, i) => (
                      <img
                        key={i}
                        src={p.url}
                        alt=""
                        className="h-32 w-full rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
