import { api } from "../lib/api";

// ===== Ficha =====
export interface RefPhoto {
  _id?: string;
  url: string;
  date: string;
  note: string;
}
export interface ChiropracticProfile {
  _id?: string;
  establishment: string;
  client: string;
  mainComplaint: string;
  history: string;
  contraindications: string;
  medications: string;
  activity: string;
  healthNotes: string;
  photos: RefPhoto[];
  _isNew?: boolean;
}
export interface ProfilePayload {
  mainComplaint?: string;
  history?: string;
  contraindications?: string;
  medications?: string;
  activity?: string;
  healthNotes?: string;
  photos?: { url: string; date?: string; note?: string }[];
}

// ===== Atendimento =====
export interface Posture {
  head: string;
  shoulders: string;
  pelvis: string;
  cervical: string;
  thoracic: string;
  lumbar: string;
  scoliosis: string;
  notes: string;
}
export const emptyPosture = (): Posture => ({
  head: "",
  shoulders: "",
  pelvis: "",
  cervical: "",
  thoracic: "",
  lumbar: "",
  scoliosis: "",
  notes: "",
});
export interface Adjustment {
  segment: string;
  technique: string;
  side: string;
  note: string;
}
export interface SessionPhoto {
  url: string;
  view: string;
  note: string;
}
export interface ChiropracticSession {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  date: string;
  eva: number;
  posture: Posture;
  posturePhotos: SessionPhoto[];
  adjustments: Adjustment[];
  recommendations: string;
  notes: string;
  nextVisit?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SessionPayload {
  date?: string;
  eva?: number;
  posture?: Posture;
  posturePhotos?: SessionPhoto[];
  adjustments?: Adjustment[];
  recommendations?: string;
  notes?: string;
  nextVisit?: string | null;
}

const base = "/chiropractic";

export const chiropracticApi = {
  getProfile: (establishmentId: string, clientId: string) =>
    api
      .get<ChiropracticProfile>(`${base}/${establishmentId}/${clientId}/profile`)
      .then((r) => r.data),
  updateProfile: (
    establishmentId: string,
    clientId: string,
    data: ProfilePayload
  ) =>
    api
      .put<ChiropracticProfile>(
        `${base}/${establishmentId}/${clientId}/profile`,
        data
      )
      .then((r) => r.data),
  listSessions: (establishmentId: string, clientId: string) =>
    api
      .get<ChiropracticSession[]>(
        `${base}/${establishmentId}/${clientId}/sessions`
      )
      .then((r) => r.data),
  createSession: (
    establishmentId: string,
    clientId: string,
    data: SessionPayload
  ) =>
    api
      .post<ChiropracticSession>(
        `${base}/${establishmentId}/${clientId}/sessions`,
        data
      )
      .then((r) => r.data),
  updateSession: (
    establishmentId: string,
    clientId: string,
    sessionId: string,
    data: SessionPayload
  ) =>
    api
      .put<ChiropracticSession>(
        `${base}/${establishmentId}/${clientId}/sessions/${sessionId}`,
        data
      )
      .then((r) => r.data),
  removeSession: (
    establishmentId: string,
    clientId: string,
    sessionId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/${clientId}/sessions/${sessionId}`
      )
      .then((r) => r.data),
};

// ===== avaliação postural estruturada: campos e opções =====
export interface PostureField {
  key: keyof Omit<Posture, "notes">;
  label: string;
  options: { value: string; label: string }[];
}
export const POSTURE_FIELDS: PostureField[] = [
  {
    key: "head",
    label: "Cabeça",
    options: [
      { value: "neutra", label: "Neutra" },
      { value: "anteriorizada", label: "Anteriorizada" },
      { value: "inclinada_d", label: "Inclinada à D" },
      { value: "inclinada_e", label: "Inclinada à E" },
      { value: "rotada_d", label: "Rotada à D" },
      { value: "rotada_e", label: "Rotada à E" },
    ],
  },
  {
    key: "shoulders",
    label: "Ombros",
    options: [
      { value: "nivelados", label: "Nivelados" },
      { value: "elevado_d", label: "Elevado à D" },
      { value: "elevado_e", label: "Elevado à E" },
    ],
  },
  {
    key: "pelvis",
    label: "Pelve",
    options: [
      { value: "nivelada", label: "Nivelada" },
      { value: "elevada_d", label: "Elevada à D" },
      { value: "elevada_e", label: "Elevada à E" },
      { value: "anteversao", label: "Anteversão" },
      { value: "retroversao", label: "Retroversão" },
    ],
  },
  {
    key: "cervical",
    label: "Cervical",
    options: [
      { value: "normal", label: "Normal" },
      { value: "retificada", label: "Retificada" },
      { value: "hiperlordose", label: "Hiperlordose" },
    ],
  },
  {
    key: "thoracic",
    label: "Torácica",
    options: [
      { value: "normal", label: "Normal" },
      { value: "hipercifose", label: "Hipercifose" },
      { value: "retificada", label: "Retificada" },
    ],
  },
  {
    key: "lumbar",
    label: "Lombar",
    options: [
      { value: "normal", label: "Normal" },
      { value: "hiperlordose", label: "Hiperlordose" },
      { value: "retificada", label: "Retificada" },
    ],
  },
  {
    key: "scoliosis",
    label: "Escoliose",
    options: [
      { value: "ausente", label: "Ausente" },
      { value: "toracica_d", label: "Torácica convex. D" },
      { value: "toracica_e", label: "Torácica convex. E" },
      { value: "lombar_d", label: "Lombar convex. D" },
      { value: "lombar_e", label: "Lombar convex. E" },
      { value: "toracolombar", label: "Toracolombar (S)" },
    ],
  },
];
export function postureOptionLabel(
  key: keyof Omit<Posture, "notes">,
  value: string
): string {
  if (!value) return "";
  const f = POSTURE_FIELDS.find((x) => x.key === key);
  return f?.options.find((o) => o.value === value)?.label || value;
}

export const TECHNIQUES = [
  "Diversificada",
  "Thompson",
  "Activator",
  "Flexão-distração",
  "Drop",
  "Mobilização",
  "Gonstead",
  "SOT",
  "Outra",
];
export const SIDES: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "D", label: "Direito" },
  { value: "E", label: "Esquerdo" },
  { value: "bilateral", label: "Bilateral" },
  { value: "central", label: "Central" },
];
export const PHOTO_VIEWS: { value: string; label: string }[] = [
  { value: "anterior", label: "Anterior" },
  { value: "posterior", label: "Posterior" },
  { value: "lateral_d", label: "Lateral D" },
  { value: "lateral_e", label: "Lateral E" },
];
export const photoViewLabel = (v: string) =>
  PHOTO_VIEWS.find((x) => x.value === v)?.label || v;

// segmentos comuns (datalist do registro de ajustes)
export const COMMON_SEGMENTS = [
  "Occipito",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "T8",
  "T9",
  "T10",
  "T11",
  "T12",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "Sacro",
  "SI D",
  "SI E",
  "Costelas",
  "Púbis",
  "ATM",
];
