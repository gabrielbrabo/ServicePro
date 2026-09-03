import { api } from "../lib/api";

export type NursingKind = "vital" | "dressing" | "medication";

// ===== Ficha =====
export interface NursingProfile {
  _id?: string;
  establishment: string;
  client: string;
  allergies: string;
  conditions: string;
  continuousMeds: string;
  bloodType: string;
  healthNotes: string;
  _isNew?: boolean;
}
export interface ProfilePayload {
  allergies?: string;
  conditions?: string;
  continuousMeds?: string;
  bloodType?: string;
  healthNotes?: string;
}

// ===== Registro (vital / dressing / medication) =====
export interface NursingRecord {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  kind: NursingKind;
  date: string;
  notes: string;
  // vitais
  systolic: number;
  diastolic: number;
  heartRate: number;
  respRate: number;
  temperature: number;
  spo2: number;
  glucose: number;
  pain: number;
  // curativo
  location: string;
  aspect: string;
  dressingType: string;
  materials: string;
  // medicacao / vacina
  medKind: string;
  name: string;
  dose: string;
  route: string;
  site: string;
  lot: string;
  expiry?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordPayload {
  kind: NursingKind;
  date?: string;
  notes?: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  respRate?: number;
  temperature?: number;
  spo2?: number;
  glucose?: number;
  pain?: number;
  location?: string;
  aspect?: string;
  dressingType?: string;
  materials?: string;
  medKind?: string;
  name?: string;
  dose?: string;
  route?: string;
  site?: string;
  lot?: string;
  expiry?: string | null;
}

const base = "/nursing";

export const nursingApi = {
  getProfile: (establishmentId: string, clientId: string) =>
    api
      .get<NursingProfile>(`${base}/${establishmentId}/${clientId}/profile`)
      .then((r) => r.data),

  updateProfile: (
    establishmentId: string,
    clientId: string,
    data: ProfilePayload
  ) =>
    api
      .put<NursingProfile>(
        `${base}/${establishmentId}/${clientId}/profile`,
        data
      )
      .then((r) => r.data),

  listRecords: (establishmentId: string, clientId: string, kind: NursingKind) =>
    api
      .get<NursingRecord[]>(
        `${base}/${establishmentId}/${clientId}/records`,
        { params: { kind } }
      )
      .then((r) => r.data),

  createRecord: (
    establishmentId: string,
    clientId: string,
    data: RecordPayload
  ) =>
    api
      .post<NursingRecord>(
        `${base}/${establishmentId}/${clientId}/records`,
        data
      )
      .then((r) => r.data),

  updateRecord: (
    establishmentId: string,
    clientId: string,
    recordId: string,
    data: RecordPayload
  ) =>
    api
      .put<NursingRecord>(
        `${base}/${establishmentId}/${clientId}/records/${recordId}`,
        data
      )
      .then((r) => r.data),

  removeRecord: (establishmentId: string, clientId: string, recordId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/${clientId}/records/${recordId}`
      )
      .then((r) => r.data),
};

// ===== sinais vitais: campos, faixas e sinalizacao =====
export interface VitalField {
  key:
    | "systolic"
    | "diastolic"
    | "heartRate"
    | "respRate"
    | "temperature"
    | "spo2"
    | "glucose"
    | "pain";
  label: string;
  short: string; // rotulo curto p/ o gráfico
  unit: string;
  step?: string;
  low?: number; // abaixo disso: sinaliza (baixo)
  high?: number; // acima disso: sinaliza (alto)
  chart?: boolean; // aparece no seletor de métrica do gráfico
}
export const VITAL_FIELDS: VitalField[] = [
  { key: "systolic", label: "PA sistólica", short: "PA sist.", unit: "mmHg", low: 90, high: 140, chart: true },
  { key: "diastolic", label: "PA diastólica", short: "PA diast.", unit: "mmHg", low: 60, high: 90, chart: true },
  { key: "heartRate", label: "FC", short: "FC", unit: "bpm", low: 60, high: 100, chart: true },
  { key: "respRate", label: "FR", short: "FR", unit: "irpm", low: 12, high: 20 },
  { key: "temperature", label: "Temp.", short: "Temp.", unit: "°C", step: "0.1", low: 35, high: 37.8, chart: true },
  { key: "spo2", label: "SpO₂", short: "SpO₂", unit: "%", low: 95, chart: true },
  { key: "glucose", label: "Glicemia", short: "Glic.", unit: "mg/dL", low: 70, high: 180, chart: true },
  { key: "pain", label: "Dor", short: "Dor", unit: "0-10", high: 7 },
];

// retorna "", "high" ou "low" conforme a faixa (0 = não medido → "")
export function vitalFlag(key: VitalField["key"], value: number): "" | "high" | "low" {
  if (!value) return "";
  const f = VITAL_FIELDS.find((x) => x.key === key);
  if (!f) return "";
  if (f.high !== undefined && value > f.high) return "high";
  if (f.low !== undefined && value < f.low) return "low";
  return "";
}
export const flagColor = (flag: "" | "high" | "low") =>
  flag === "high"
    ? "text-red-600"
    : flag === "low"
    ? "text-sky-600"
    : "text-ink/70";

export const ROUTES = [
  "VO",
  "IM",
  "EV",
  "SC",
  "ID",
  "Tópica",
  "Inalatória",
  "Sublingual",
  "Retal",
  "Oftálmica",
];

export const MED_KINDS: { key: string; label: string }[] = [
  { key: "medicacao", label: "Medicação" },
  { key: "vacina", label: "Vacina" },
];
