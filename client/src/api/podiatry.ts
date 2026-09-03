import { api } from "../lib/api";

// ===== Ficha / perfil do paciente =====
export interface FootPhoto {
  _id?: string;
  url: string;
  date: string;
  note: string;
}

export interface PodiatryProfile {
  _id?: string;
  establishment: string;
  client: string;
  mainComplaint: string;
  diabetic: boolean;
  circulationNotes: string;
  footType: string;
  footwear: string;
  allergies: string;
  healthNotes: string;
  photos: FootPhoto[];
  _isNew?: boolean;
}

export interface ProfilePayload {
  mainComplaint?: string;
  diabetic?: boolean;
  circulationNotes?: string;
  footType?: string;
  footwear?: string;
  allergies?: string;
  healthNotes?: string;
  photos?: { url: string; date?: string; note?: string }[];
}

// ===== Atendimento (mapa do pé + procedimentos + antes/depois) =====
export type FootSide = "left" | "right";
export type FootView = "dorsal" | "plantar";

export interface Finding {
  foot: FootSide;
  view: FootView;
  region: string;
  condition: string;
  severity: string;
  note: string;
}
export interface Procedure {
  name: string;
  region: string;
  materials: string;
  note: string;
}
export interface SessionPhoto {
  url: string;
  note: string;
}
export interface PodiatrySession {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  date: string;
  findings: Finding[];
  procedures: Procedure[];
  beforePhotos: SessionPhoto[];
  afterPhotos: SessionPhoto[];
  recommendations: string;
  notes: string;
  nextVisit?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SessionPayload {
  date?: string;
  findings?: Finding[];
  procedures?: Procedure[];
  beforePhotos?: SessionPhoto[];
  afterPhotos?: SessionPhoto[];
  recommendations?: string;
  notes?: string;
  nextVisit?: string | null;
}

const base = "/podiatry";

export const podiatryApi = {
  getProfile: (establishmentId: string, clientId: string) =>
    api
      .get<PodiatryProfile>(`${base}/${establishmentId}/${clientId}/profile`)
      .then((r) => r.data),

  updateProfile: (
    establishmentId: string,
    clientId: string,
    data: ProfilePayload
  ) =>
    api
      .put<PodiatryProfile>(
        `${base}/${establishmentId}/${clientId}/profile`,
        data
      )
      .then((r) => r.data),

  listSessions: (establishmentId: string, clientId: string) =>
    api
      .get<PodiatrySession[]>(
        `${base}/${establishmentId}/${clientId}/sessions`
      )
      .then((r) => r.data),

  createSession: (
    establishmentId: string,
    clientId: string,
    data: SessionPayload
  ) =>
    api
      .post<PodiatrySession>(
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
      .put<PodiatrySession>(
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

  sessionPdf: (establishmentId: string, clientId: string, sessionId: string) =>
    api
      .get<Blob>(
        `${base}/${establishmentId}/${clientId}/sessions/${sessionId}/pdf`,
        { responseType: "blob" }
      )
      .then((r) => r.data),
};

// ===== dados do mapa do pé =====

export const FOOT_LABELS: Record<FootSide, string> = {
  left: "Pé esquerdo",
  right: "Pé direito",
};
export const VIEW_LABELS: Record<FootView, string> = {
  dorsal: "Dorso",
  plantar: "Planta (sola)",
};

export interface RegionDef {
  key: string;
  label: string;
  // posição do marcador no viewBox 0 0 120 270 (pé esquerdo; o direito espelha)
  cx: number;
  cy: number;
}
export const REGIONS: RegionDef[] = [
  { key: "nails", label: "Unhas", cx: 52, cy: 40 },
  { key: "hallux", label: "Hálux", cx: 78, cy: 50 },
  { key: "toes", label: "Dedos (2º-5º)", cx: 36, cy: 50 },
  { key: "interdigital", label: "Interdigital", cx: 56, cy: 72 },
  { key: "forefoot", label: "Antepé", cx: 58, cy: 110 },
  { key: "lateral", label: "Borda lateral", cx: 30, cy: 152 },
  { key: "arch", label: "Arco", cx: 82, cy: 168 },
  { key: "heel", label: "Calcanhar", cx: 56, cy: 228 },
];
export const regionLabel = (key: string) =>
  REGIONS.find((r) => r.key === key)?.label || key;

export interface ConditionDef {
  key: string;
  label: string;
  color: string; // cor do marcador (hex)
}
export const CONDITIONS: ConditionDef[] = [
  { key: "calo", label: "Calo / calosidade", color: "#d97706" },
  { key: "micose", label: "Micose (pele)", color: "#7c3aed" },
  { key: "onicomicose", label: "Onicomicose (unha)", color: "#9333ea" },
  { key: "unha_encravada", label: "Unha encravada", color: "#dc2626" },
  { key: "fissura", label: "Fissura / rachadura", color: "#ea580c" },
  { key: "verruga", label: "Verruga plantar", color: "#2563eb" },
  { key: "bolha", label: "Bolha", color: "#0891b2" },
  { key: "ferida", label: "Ferida / úlcera", color: "#b91c1c" },
  { key: "ressecamento", label: "Ressecamento", color: "#65a30d" },
  { key: "outro", label: "Outro", color: "#6b7280" },
];
export const conditionDef = (key: string) =>
  CONDITIONS.find((c) => c.key === key);
export const conditionLabel = (key: string) =>
  conditionDef(key)?.label || key;
export const conditionColor = (key: string) =>
  conditionDef(key)?.color || "#6b7280";

export const SEVERITIES: { key: string; label: string }[] = [
  { key: "leve", label: "Leve" },
  { key: "moderado", label: "Moderado" },
  { key: "grave", label: "Grave" },
];

export const FOOT_TYPES: { key: string; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "plano", label: "Plano (chato)" },
  { key: "cavo", label: "Cavo" },
];

// silhueta esquemática do pé (viewBox 0 0 120 270); o pé direito espelha em X
export const FOOT_OUTLINE =
  "M38,250 C28,250 22,235 24,215 C18,190 20,165 26,150 C18,138 18,112 28,100 " +
  "C34,82 30,64 46,58 L74,58 C90,64 94,86 88,104 C96,120 94,150 86,168 " +
  "C92,190 92,235 82,250 C74,262 46,262 38,250 Z";
// dedos (círculos decorativos), do hálux ao 5º dedo
export const FOOT_TOES: { cx: number; cy: number; r: number }[] = [
  { cx: 78, cy: 46, r: 11 },
  { cx: 58, cy: 38, r: 8 },
  { cx: 44, cy: 40, r: 7 },
  { cx: 33, cy: 46, r: 6 },
  { cx: 24, cy: 54, r: 5 },
];
