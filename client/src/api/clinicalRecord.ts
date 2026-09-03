import { api } from "../lib/api";

export interface ClinicalSession {
  date: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  cid: string;
}

export interface ClinicalRecord {
  _id: string;
  establishment: string;
  patientName: string;
  patientPhone: string;
  complaint: string;
  history: string;
  sessions: ClinicalSession[];
  nextReturn: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ClinicalRecordPayload = Partial<
  Omit<ClinicalRecord, "_id" | "establishment" | "createdAt" | "updatedAt">
>;

const base = "/clinical-records";
export const clinicalRecordApi = {
  list: (e: string) =>
    api.get<ClinicalRecord[]>(`${base}/${e}`).then((r) => r.data),
  create: (e: string, d: ClinicalRecordPayload) =>
    api.post<ClinicalRecord>(`${base}/${e}`, d).then((r) => r.data),
  update: (e: string, id: string, d: ClinicalRecordPayload) =>
    api.put<ClinicalRecord>(`${base}/${e}/${id}`, d).then((r) => r.data),
  pdf: (e: string, id: string) =>
    api
      .get<Blob>(`${base}/${e}/${id}/pdf`, { responseType: "blob" })
      .then((r) => r.data),
  remove: (e: string, id: string) =>
    api
      .delete<{ message: string; _id: string }>(`${base}/${e}/${id}`)
      .then((r) => r.data),
};
