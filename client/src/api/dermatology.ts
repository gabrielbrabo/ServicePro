import { api } from "../lib/api";

// ===== Ficha =====
export interface RefPhoto {
  _id?: string;
  url: string;
  date: string;
  note: string;
}
export interface DermatologyProfile {
  _id?: string;
  establishment: string;
  client: string;
  phototype: string;
  mainComplaint: string;
  skinCancerHistory: string;
  sunExposure: string;
  allergies: string;
  medications: string;
  healthNotes: string;
  photos: RefPhoto[];
  _isNew?: boolean;
}
export interface ProfilePayload {
  phototype?: string;
  mainComplaint?: string;
  skinCancerHistory?: string;
  sunExposure?: string;
  allergies?: string;
  medications?: string;
  healthNotes?: string;
  photos?: { url: string; date?: string; note?: string }[];
}

// ===== Atendimento (mapa de lesões + antes/depois) =====
export type BodyView = "front" | "back";
export interface Finding {
  region: string;
  view: BodyView;
  type: string;
  size: number;
  color: string;
  abcde: string[];
  note: string;
}
export interface SessionPhoto {
  url: string;
  note: string;
}
export interface DermatologySession {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  date: string;
  findings: Finding[];
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
  beforePhotos?: SessionPhoto[];
  afterPhotos?: SessionPhoto[];
  recommendations?: string;
  notes?: string;
  nextVisit?: string | null;
}

const base = "/dermatology";

export const dermatologyApi = {
  getProfile: (establishmentId: string, clientId: string) =>
    api
      .get<DermatologyProfile>(`${base}/${establishmentId}/${clientId}/profile`)
      .then((r) => r.data),
  updateProfile: (
    establishmentId: string,
    clientId: string,
    data: ProfilePayload
  ) =>
    api
      .put<DermatologyProfile>(
        `${base}/${establishmentId}/${clientId}/profile`,
        data
      )
      .then((r) => r.data),
  listSessions: (establishmentId: string, clientId: string) =>
    api
      .get<DermatologySession[]>(
        `${base}/${establishmentId}/${clientId}/sessions`
      )
      .then((r) => r.data),
  createSession: (
    establishmentId: string,
    clientId: string,
    data: SessionPayload
  ) =>
    api
      .post<DermatologySession>(
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
      .put<DermatologySession>(
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

// ===== dados do mapa do corpo =====
export const VIEW_LABELS: Record<BodyView, string> = {
  front: "Frente",
  back: "Costas",
};

export interface RegionDef {
  key: string;
  label: string;
  cx: number; // viewBox 0 0 120 300 (mesma silhueta p/ frente e costas)
  cy: number;
}
// Convenção visual: "D" (direito) à direita da imagem, "E" (esquerdo) à esquerda.
export const REGIONS: RegionDef[] = [
  { key: "cabeca", label: "Cabeça / face", cx: 60, cy: 22 },
  { key: "pescoco", label: "Pescoço", cx: 60, cy: 46 },
  { key: "ombroE", label: "Ombro E", cx: 40, cy: 62 },
  { key: "ombroD", label: "Ombro D", cx: 80, cy: 62 },
  { key: "torax", label: "Tórax / dorso", cx: 60, cy: 90 },
  { key: "abdome", label: "Abdômen / lombar", cx: 60, cy: 126 },
  { key: "bracoE", label: "Braço E", cx: 30, cy: 100 },
  { key: "bracoD", label: "Braço D", cx: 90, cy: 100 },
  { key: "antebracoE", label: "Antebraço E", cx: 22, cy: 138 },
  { key: "antebracoD", label: "Antebraço D", cx: 98, cy: 138 },
  { key: "maoE", label: "Mão E", cx: 16, cy: 168 },
  { key: "maoD", label: "Mão D", cx: 104, cy: 168 },
  { key: "coxaE", label: "Coxa E", cx: 49, cy: 188 },
  { key: "coxaD", label: "Coxa D", cx: 71, cy: 188 },
  { key: "pernaE", label: "Perna E", cx: 47, cy: 238 },
  { key: "pernaD", label: "Perna D", cx: 73, cy: 238 },
  { key: "peE", label: "Pé E", cx: 46, cy: 285 },
  { key: "peD", label: "Pé D", cx: 74, cy: 285 },
];
export const regionLabel = (key: string) =>
  REGIONS.find((r) => r.key === key)?.label || key;

export interface LesionType {
  key: string;
  label: string;
  color: string;
}
export const LESION_TYPES: LesionType[] = [
  { key: "pinta", label: "Pinta / nevo", color: "#92400e" },
  { key: "mancha", label: "Mancha", color: "#d97706" },
  { key: "lesao", label: "Lesão", color: "#dc2626" },
  { key: "verruga", label: "Verruga", color: "#2563eb" },
  { key: "queratose", label: "Queratose", color: "#ea580c" },
  { key: "suspeita", label: "Suspeita (ABCDE)", color: "#7c3aed" },
  { key: "outro", label: "Outro", color: "#6b7280" },
];
export const lesionType = (key: string) =>
  LESION_TYPES.find((t) => t.key === key);
export const lesionLabel = (key: string) => lesionType(key)?.label || key;
export const lesionColor = (key: string) => lesionType(key)?.color || "#6b7280";

// critérios ABCDE de melanoma
export const ABCDE_ITEMS: { key: string; label: string }[] = [
  { key: "A", label: "Assimetria" },
  { key: "B", label: "Bordas irregulares" },
  { key: "C", label: "Cor variada" },
  { key: "D", label: "Diâmetro > 6 mm" },
  { key: "E", label: "Evolução" },
];

export const PHOTOTYPES = ["I", "II", "III", "IV", "V", "VI"];

// silhueta esquemática do corpo (viewBox 0 0 120 300) — usada nas duas vistas.
// Partes desenhadas como formas simples (robusto e legível).
export const BODY = {
  head: { cx: 60, cy: 22, r: 15 },
  neck: { x: 55, y: 33, w: 10, h: 12 },
  // tronco (trapézio arredondado)
  torso: "M42,45 Q60,39 78,45 L73,150 Q60,158 47,150 Z",
  // membros como linhas grossas (stroke) com pontas arredondadas
  limbs: [
    "M46,50 L16,170", // braço E
    "M74,50 L104,170", // braço D
    "M54,150 L45,292", // perna E
    "M66,150 L75,292", // perna D
  ],
};
