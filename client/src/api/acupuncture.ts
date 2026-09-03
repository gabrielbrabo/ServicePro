import { api } from "../lib/api";

// ===== Ficha =====
export interface AcupunctureProfile {
  _id?: string;
  establishment: string;
  client: string;
  mainComplaint: string;
  tcmPattern: string;
  tongue: string;
  pulse: string;
  contraindications: string;
  healthNotes: string;
  _isNew?: boolean;
}
export interface ProfilePayload {
  mainComplaint?: string;
  tcmPattern?: string;
  tongue?: string;
  pulse?: string;
  contraindications?: string;
  healthNotes?: string;
}

// ===== Sessão =====
export interface Point {
  point: string;
  side: string;
  method: string;
  stimulation: string;
  note: string;
}
export interface AcupunctureSession {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  date: string;
  eva: number;
  retentionMin: number;
  points: Point[];
  tcmNotes: string;
  recommendations: string;
  notes: string;
  nextVisit?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SessionPayload {
  date?: string;
  eva?: number;
  retentionMin?: number;
  points?: Point[];
  tcmNotes?: string;
  recommendations?: string;
  notes?: string;
  nextVisit?: string | null;
}

const base = "/acupuncture";

export const acupunctureApi = {
  getProfile: (establishmentId: string, clientId: string) =>
    api
      .get<AcupunctureProfile>(`${base}/${establishmentId}/${clientId}/profile`)
      .then((r) => r.data),
  updateProfile: (
    establishmentId: string,
    clientId: string,
    data: ProfilePayload
  ) =>
    api
      .put<AcupunctureProfile>(
        `${base}/${establishmentId}/${clientId}/profile`,
        data
      )
      .then((r) => r.data),
  listSessions: (establishmentId: string, clientId: string) =>
    api
      .get<AcupunctureSession[]>(
        `${base}/${establishmentId}/${clientId}/sessions`
      )
      .then((r) => r.data),
  createSession: (
    establishmentId: string,
    clientId: string,
    data: SessionPayload
  ) =>
    api
      .post<AcupunctureSession>(
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
      .put<AcupunctureSession>(
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

// ===== opções dos pontos =====
export const POINT_METHODS: { value: string; label: string }[] = [
  { value: "agulha", label: "Agulha" },
  { value: "moxa", label: "Moxa" },
  { value: "eletro", label: "Eletroacupuntura" },
  { value: "ventosa", label: "Ventosa" },
  { value: "auricular", label: "Auricular" },
  { value: "laser", label: "Laser" },
];
export const methodLabel = (v: string) =>
  POINT_METHODS.find((m) => m.value === v)?.label || v;

export const STIMULATIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "tonificar", label: "Tonificar" },
  { value: "sedar", label: "Sedar" },
  { value: "neutro", label: "Neutro" },
];

export const SIDES: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "D", label: "Direito" },
  { value: "E", label: "Esquerdo" },
  { value: "bilateral", label: "Bilateral" },
  { value: "central", label: "Central" },
];

// pontos frequentes (datalist) — abreviacoes de meridianos em pt-BR
export const COMMON_POINTS = [
  "IG4",
  "IG11",
  "E36",
  "E44",
  "BP6",
  "BP9",
  "B23",
  "B40",
  "B60",
  "VG20",
  "VG14",
  "VG4",
  "VC4",
  "VC6",
  "VC12",
  "F3",
  "VB34",
  "VB20",
  "VB21",
  "R3",
  "R6",
  "P7",
  "ID3",
  "TA5",
  "CS6",
  "C7",
  "Yintang",
  "Taiyang",
  "Baihui",
];
