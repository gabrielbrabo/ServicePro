import { api } from "../lib/api";

// ===== Pacote de sessoes =====
export interface SessionUse {
  _id: string;
  date: string;
  by: string;
  note?: string;
}

export type PackageStatus = "ativo" | "concluido" | "cancelado";

export interface SessionPackage {
  _id: string;
  establishment: string;
  client: string;
  title: string;
  totalSessions: number;
  uses: SessionUse[];
  price: number;
  notes: string;
  status: PackageStatus;
  createdAt: string;
  updatedAt: string;
}

// ===== Avaliacao fisioterapeutica =====
export interface PhysioAssessment {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  date: string;
  mainComplaint: string;
  painEva: number | null;
  rangeOfMotion: string;
  muscleStrength: string;
  observations: string;
  goals: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentPayload {
  date?: string;
  mainComplaint?: string;
  painEva?: number | null;
  rangeOfMotion?: string;
  muscleStrength?: string;
  observations?: string;
  goals?: string;
}

const base = "/physio";

export const physioApi = {
  // ---- pacotes ----
  listPackages: (establishmentId: string, clientId: string) =>
    api
      .get<SessionPackage[]>(`${base}/${establishmentId}/${clientId}/packages`)
      .then((r) => r.data),

  createPackage: (
    establishmentId: string,
    clientId: string,
    data: { title?: string; totalSessions: number; price?: number; notes?: string }
  ) =>
    api
      .post<SessionPackage>(
        `${base}/${establishmentId}/${clientId}/packages`,
        data
      )
      .then((r) => r.data),

  updatePackage: (
    establishmentId: string,
    clientId: string,
    packageId: string,
    data: {
      title?: string;
      totalSessions?: number;
      price?: number;
      notes?: string;
      status?: PackageStatus;
    }
  ) =>
    api
      .patch<SessionPackage>(
        `${base}/${establishmentId}/${clientId}/packages/${packageId}`,
        data
      )
      .then((r) => r.data),

  addUse: (
    establishmentId: string,
    clientId: string,
    packageId: string,
    data?: { date?: string; note?: string }
  ) =>
    api
      .post<SessionPackage>(
        `${base}/${establishmentId}/${clientId}/packages/${packageId}/uses`,
        data || {}
      )
      .then((r) => r.data),

  removeUse: (
    establishmentId: string,
    clientId: string,
    packageId: string,
    useId: string
  ) =>
    api
      .delete<SessionPackage>(
        `${base}/${establishmentId}/${clientId}/packages/${packageId}/uses/${useId}`
      )
      .then((r) => r.data),

  removePackage: (
    establishmentId: string,
    clientId: string,
    packageId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/${clientId}/packages/${packageId}`
      )
      .then((r) => r.data),

  // ---- avaliacoes ----
  listAssessments: (establishmentId: string, clientId: string) =>
    api
      .get<PhysioAssessment[]>(
        `${base}/${establishmentId}/${clientId}/assessments`
      )
      .then((r) => r.data),

  createAssessment: (
    establishmentId: string,
    clientId: string,
    data: AssessmentPayload
  ) =>
    api
      .post<PhysioAssessment>(
        `${base}/${establishmentId}/${clientId}/assessments`,
        data
      )
      .then((r) => r.data),

  updateAssessment: (
    establishmentId: string,
    clientId: string,
    assessmentId: string,
    data: AssessmentPayload
  ) =>
    api
      .put<PhysioAssessment>(
        `${base}/${establishmentId}/${clientId}/assessments/${assessmentId}`,
        data
      )
      .then((r) => r.data),

  removeAssessment: (
    establishmentId: string,
    clientId: string,
    assessmentId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/${clientId}/assessments/${assessmentId}`
      )
      .then((r) => r.data),
};
