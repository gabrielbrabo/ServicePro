import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";
import {
  chiropracticApi,
  ChiropracticProfile,
  ChiropracticSession,
  Posture,
  Adjustment,
  SessionPhoto,
  ProfilePayload,
  emptyPosture,
  POSTURE_FIELDS,
  postureOptionLabel,
  TECHNIQUES,
  SIDES,
  PHOTO_VIEWS,
  photoViewLabel,
  COMMON_SEGMENTS,
} from "../api/chiropractic";
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

// ============ ENTRADA ============
export function QuiropraxiaManager({
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
type PatientView = "ficha" | "atendimentos" | "evolucao";

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
  const [sessions, setSessions] = useState<ChiropracticSession[]>([]);
  const [loadingS, setLoadingS] = useState(true);
  const [contra, setContra] = useState("");

  useEffect(() => {
    setLoadingS(true);
    chiropracticApi
      .listSessions(establishmentId, clientId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadingS(false));
    chiropracticApi
      .getProfile(establishmentId, clientId)
      .then((p) => setContra(p.contraindications || ""))
      .catch(() => setContra(""));
  }, [establishmentId, clientId]);

  const last = sessions[0];
  const tabs: [PatientView, string][] = [
    ["ficha", "Ficha"],
    ["atendimentos", "Atendimentos"],
    ["evolucao", "Evolução"],
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
      {contra && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <span aria-hidden="true">⚠️</span>
          <span>Contraindicações / red flags: {contra}</span>
        </div>
      )}

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
            onContra={setContra}
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
        {view === "evolucao" && (
          <EvolutionSection items={sessions} loading={loadingS} />
        )}
      </div>
    </div>
  );
}

// ============ FICHA ============
function ProfileSection({
  establishmentId,
  clientId,
  onContra,
}: {
  establishmentId: string;
  clientId: string;
  onContra?: (v: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [f, setF] = useState({
    mainComplaint: "",
    history: "",
    contraindications: "",
    medications: "",
    activity: "",
    healthNotes: "",
  });
  const [photos, setPhotos] = useState<
    { url: string; date: string; note: string }[]
  >([]);

  useEffect(() => {
    setLoading(true);
    chiropracticApi
      .getProfile(establishmentId, clientId)
      .then((p: ChiropracticProfile) => {
        setF({
          mainComplaint: p.mainComplaint || "",
          history: p.history || "",
          contraindications: p.contraindications || "",
          medications: p.medications || "",
          activity: p.activity || "",
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
        mainComplaint: f.mainComplaint.trim(),
        history: f.history.trim(),
        contraindications: f.contraindications.trim(),
        medications: f.medications.trim(),
        activity: f.activity.trim(),
        healthNotes: f.healthNotes.trim(),
        photos: photos.map((p) => ({
          url: p.url,
          date: p.date || undefined,
          note: p.note.trim(),
        })),
      };
      await chiropracticApi.updateProfile(establishmentId, clientId, payload);
      onContra?.(f.contraindications.trim());
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
            value={f.mainComplaint}
            onChange={(e) => set("mainComplaint", e.target.value)}
            rows={2}
            placeholder="Ex: dor lombar há 2 semanas, irradiando para a perna D"
            className={area}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Histórico</span>
          <textarea
            value={f.history}
            onChange={(e) => set("history", e.target.value)}
            rows={2}
            className={area}
          />
        </label>
        <label className="mt-3 block">
          <span className={lbl}>Contraindicações / red flags</span>
          <textarea
            value={f.contraindications}
            onChange={(e) => set("contraindications", e.target.value)}
            rows={2}
            placeholder="Ex: osteoporose grave, fratura recente, sinais neurológicos"
            className={area}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Medicações em uso</span>
            <input
              value={f.medications}
              onChange={(e) => set("medications", e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Atividade / ergonomia / esporte</span>
            <input
              value={f.activity}
              onChange={(e) => set("activity", e.target.value)}
              className={input}
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className={lbl}>Observações</span>
          <textarea
            value={f.healthNotes}
            onChange={(e) => set("healthNotes", e.target.value)}
            rows={2}
            className={area}
          />
        </label>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">Fotos posturais de referência</h3>
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
            folder="quiropraxia"
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

// ============ ATENDIMENTOS ============
const emptyAdjustment = (): Adjustment => ({
  segment: "",
  technique: TECHNIQUES[0],
  side: "",
  note: "",
});
interface SessionForm {
  date: string;
  eva: string;
  posture: Posture;
  posturePhotos: SessionPhoto[];
  adjustments: Adjustment[];
  recommendations: string;
  notes: string;
  nextVisit: string;
}
const emptySessionForm = (): SessionForm => ({
  date: toDateInput(new Date()),
  eva: "",
  posture: emptyPosture(),
  posturePhotos: [],
  adjustments: [],
  recommendations: "",
  notes: "",
  nextVisit: "",
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
  items: ChiropracticSession[];
  loading: boolean;
  setItems: React.Dispatch<React.SetStateAction<ChiropracticSession[]>>;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SessionForm>(emptySessionForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setForm(emptySessionForm());
    setEditing("new");
    setError(null);
  };
  const openEdit = (s: ChiropracticSession) => {
    setForm({
      date: toDateInput(new Date(s.date)),
      eva: s.eva ? String(s.eva) : "",
      posture: { ...emptyPosture(), ...s.posture },
      posturePhotos: s.posturePhotos.map((p) => ({ ...p })),
      adjustments: s.adjustments.map((a) => ({ ...a })),
      recommendations: s.recommendations || "",
      notes: s.notes || "",
      nextVisit: s.nextVisit ? toDateInput(new Date(s.nextVisit)) : "",
    });
    setEditing(s._id);
    setError(null);
  };
  const cancel = () => {
    setEditing(null);
    setForm(emptySessionForm());
  };

  const setPosture = (k: keyof Posture, v: string) =>
    setForm((f) => ({ ...f, posture: { ...f.posture, [k]: v } }));

  // ajustes
  const addAdjustment = () =>
    setForm((f) => ({ ...f, adjustments: [...f.adjustments, emptyAdjustment()] }));
  const setAdjustment = (i: number, k: keyof Adjustment, v: string) =>
    setForm((f) => {
      const adjustments = [...f.adjustments];
      adjustments[i] = { ...adjustments[i], [k]: v };
      return { ...f, adjustments };
    });
  const removeAdjustment = (i: number) =>
    setForm((f) => ({
      ...f,
      adjustments: f.adjustments.filter((_, idx) => idx !== i),
    }));

  // fotos posturais
  const addPhoto = (url: string) => {
    if (!url) return;
    setForm((f) => ({
      ...f,
      posturePhotos: [...f.posturePhotos, { url, view: "anterior", note: "" }],
    }));
  };
  const setPhoto = (url: string, k: "view" | "note", v: string) =>
    setForm((f) => ({
      ...f,
      posturePhotos: f.posturePhotos.map((p) =>
        p.url === url ? { ...p, [k]: v } : p
      ),
    }));
  const removePhoto = (url: string) => {
    setForm((f) => ({
      ...f,
      posturePhotos: f.posturePhotos.filter((p) => p.url !== url),
    }));
    void deleteUploadByUrl(url);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      date: form.date || undefined,
      eva: Number(form.eva) || 0,
      posture: form.posture,
      posturePhotos: form.posturePhotos,
      adjustments: form.adjustments.filter((a) => a.segment.trim() !== ""),
      recommendations: form.recommendations.trim(),
      notes: form.notes.trim(),
      nextVisit: form.nextVisit || null,
    };
    try {
      if (editing && editing !== "new") {
        const updated = await chiropracticApi.updateSession(
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
        const created = await chiropracticApi.createSession(
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

  const remove = async (s: ChiropracticSession) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== s._id));
    try {
      await chiropracticApi.removeSession(establishmentId, clientId, s._id);
    } catch {
      setItems(prev);
      setError("Não foi possível remover o atendimento.");
    }
  };

  if (editing) {
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
              <span className={lbl}>Data do atendimento</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Dor (EVA 0-10)</span>
              <input
                type="number"
                min="0"
                max="10"
                value={form.eva}
                onChange={(e) => setForm((f) => ({ ...f, eva: e.target.value }))}
                className={input}
              />
            </label>
          </div>
        </div>

        {/* AVALIAÇÃO POSTURAL */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-display font-bold text-ink">Avaliação postural</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POSTURE_FIELDS.map((pf) => (
              <label key={pf.key} className="block">
                <span className={lbl}>{pf.label}</span>
                <select
                  value={form.posture[pf.key]}
                  onChange={(e) => setPosture(pf.key, e.target.value)}
                  className={input}
                >
                  <option value="">—</option>
                  {pf.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="mt-3 block">
            <span className={lbl}>Observações da postura</span>
            <textarea
              value={form.posture.notes}
              onChange={(e) => setPosture("notes", e.target.value)}
              rows={2}
              className={area}
            />
          </label>

          {/* fotos posturais */}
          <div className="mt-4">
            <span className={lbl}>Fotos posturais</span>
            {form.posturePhotos.length > 0 && (
              <div className="mb-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {form.posturePhotos.map((p) => (
                  <div
                    key={p.url}
                    className="rounded-xl border border-ink/10 bg-sand/40 p-2"
                  >
                    <div className="relative">
                      <img
                        src={p.url}
                        alt=""
                        className="h-32 w-full rounded-lg object-cover"
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
                    <select
                      value={p.view}
                      onChange={(e) => setPhoto(p.url, "view", e.target.value)}
                      className="mt-2 h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-xs outline-none focus:border-teal-500"
                    >
                      {PHOTO_VIEWS.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <ImageUpload
              value=""
              onChange={addPhoto}
              folder="quiropraxia"
              label=""
              hint=""
            />
          </div>
        </div>

        {/* REGISTRO DE AJUSTES */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-display font-bold text-ink">Registro de ajustes</h3>
          {form.adjustments.length === 0 && (
            <p className="mt-1 text-sm text-ink/50">Nenhum ajuste adicionado.</p>
          )}
          <datalist id="quiro-segments">
            {COMMON_SEGMENTS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <div className="mt-2 space-y-2">
            {form.adjustments.map((a, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-xl border border-ink/10 bg-sand/40 p-3 sm:grid-cols-12"
              >
                <input
                  list="quiro-segments"
                  value={a.segment}
                  onChange={(e) => setAdjustment(i, "segment", e.target.value)}
                  placeholder="Segmento (ex: L5, SI D)"
                  className={`${input} sm:col-span-3`}
                />
                <select
                  value={a.technique}
                  onChange={(e) => setAdjustment(i, "technique", e.target.value)}
                  className={`${input} sm:col-span-3`}
                >
                  {TECHNIQUES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  value={a.side}
                  onChange={(e) => setAdjustment(i, "side", e.target.value)}
                  className={`${input} sm:col-span-2`}
                >
                  {SIDES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <input
                  value={a.note}
                  onChange={(e) => setAdjustment(i, "note", e.target.value)}
                  placeholder="Observação"
                  className={`${input} sm:col-span-3`}
                />
                <div className="sm:col-span-1">
                  <button
                    onClick={() => removeAdjustment(i)}
                    className="h-10 w-full rounded-lg border border-ink/15 text-sm font-medium text-red-500 hover:bg-red-50"
                    aria-label="Remover ajuste"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addAdjustment}
            className="mt-3 text-sm font-semibold text-teal-600 hover:underline"
          >
            + Adicionar ajuste
          </button>
        </div>

        {/* notas */}
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <label className="block">
            <span className={lbl}>Orientações ao paciente</span>
            <textarea
              value={form.recommendations}
              onChange={(e) =>
                setForm((f) => ({ ...f, recommendations: e.target.value }))
              }
              rows={2}
              placeholder="Ex: alongamentos, ergonomia no trabalho, retorno em 7 dias"
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

        {/* próxima visita → agenda */}
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
          Cada atendimento registra a avaliação postural, os ajustes realizados
          e a próxima visita.
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
            const posture = POSTURE_FIELDS.map((pf) => ({
              label: pf.label,
              val: postureOptionLabel(pf.key, s.posture?.[pf.key] || ""),
            })).filter((x) => x.val);
            return (
              <div
                key={s._id}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">
                    {fmtDate(s.date)}
                    {s.eva ? (
                      <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink/60">
                        EVA {s.eva}
                      </span>
                    ) : null}
                  </p>
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
                    {s.adjustments.length} ajuste
                    {s.adjustments.length !== 1 ? "s" : ""}
                  </span>
                  {s.nextVisit && (
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink/50">
                      Retorno: {fmtDate(s.nextVisit)}
                    </span>
                  )}
                </div>
                {posture.length > 0 && (
                  <p className="mt-2 text-xs text-ink/50">
                    {posture.map((x) => `${x.label}: ${x.val}`).join("  ·  ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ EVOLUÇÃO (EVA) ============
function EvolutionSection({
  items,
  loading,
}: {
  items: ChiropracticSession[];
  loading: boolean;
}) {
  const points = useMemo(
    () =>
      [...items]
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        .map((s) => ({ date: s.date, value: s.eva || 0 }))
        .filter((p) => p.value > 0),
    [items]
  );

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando...
      </div>
    );

  if (points.length < 2)
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
        Registre a dor (EVA) em pelo menos dois atendimentos para ver a
        evolução.
      </div>
    );

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h3 className="mb-3 font-display font-bold text-ink">
        Evolução da dor (EVA 0-10)
      </h3>
      <LineChart points={points} unit="EVA" />
    </div>
  );
}

// gráfico de linha SVG (sem dependências)
function LineChart({
  points,
  unit,
}: {
  points: { date: string; value: number }[];
  unit: string;
}) {
  if (points.length === 0)
    return (
      <p className="py-8 text-center text-sm text-ink/40">Sem dados ainda.</p>
    );
  const W = 520;
  const H = 200;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const values = points.map((p) => p.value);
  let min = Math.min(...values, 0);
  let max = Math.max(...values, 10);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const spanX = points.length > 1 ? points.length - 1 : 1;
  const x = (i: number) => padL + (i / spanX) * (W - padL - padR);
  const y = (v: number) =>
    padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`
    )
    .join(" ");
  const ticks = 5;
  const gridVals = Array.from(
    { length: ticks + 1 },
    (_, i) => min + ((max - min) * i) / ticks
  );
  const fmt = (iso: string) => fmtDate(iso).slice(0, 5);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Gráfico de evolução"
      >
        {gridVals.map((gv, i) => {
          const gy = y(gv);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={gy}
                y2={gy}
                stroke="currentColor"
                className="text-ink/10"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={gy + 3}
                textAnchor="end"
                className="fill-ink/40"
                fontSize={9}
              >
                {gv.toFixed(0)}
              </text>
            </g>
          );
        })}
        <path
          d={path}
          fill="none"
          stroke="#14b8a6"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={3.5} fill="#0f766e" />
            <text
              x={x(i)}
              y={H - padB + 14}
              textAnchor="middle"
              className="fill-ink/40"
              fontSize={8.5}
            >
              {fmt(p.date)}
            </text>
          </g>
        ))}
        <text x={padL} y={11} className="fill-ink/40" fontSize={9}>
          ({unit})
        </text>
      </svg>
    </div>
  );
}
