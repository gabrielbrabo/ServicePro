import { api } from "../lib/api";

export type ProjectStatus =
  | "orcamento"
  | "em_andamento"
  | "concluida"
  | "cancelada";

export type ProjectFrequency =
  | "diaria"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "personalizada";

export interface ProjectStage {
  name: string;
  value: number;
  progress: number;
}
export interface ProjectMeasurement {
  date: string;
  note: string;
  amount: number;
  method: "dinheiro" | "cartao" | "pix" | "outro";
  postedToCash: boolean;
  createdAt: string;
}

export interface ConstructionProject {
  _id: string;
  establishment: string;
  number: number;
  client: string | null;
  clientName: string;
  clientPhone: string;
  title: string;
  location: string;
  status: ProjectStatus;
  stages: ProjectStage[];
  measurements: ProjectMeasurement[];
  service: string | null;
  professional: string | null;
  startDate: string;
  time: string;
  frequency: ProjectFrequency;
  visitsCount: number;
  seriesId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ConstructionProjectPayload = Partial<
  Omit<
    ConstructionProject,
    | "_id"
    | "establishment"
    | "number"
    | "measurements"
    | "seriesId"
    | "createdAt"
    | "updatedAt"
  >
>;

export interface ScheduleResult {
  project: ConstructionProject;
  seriesId: string;
  createdCount: number;
  skippedCount: number;
  skipped: { date: string; reason: string }[];
}

const base = "/construction-projects";

export const constructionProjectApi = {
  list: (establishmentId: string) =>
    api.get<ConstructionProject[]>(`${base}/${establishmentId}`).then((r) => r.data),

  create: (establishmentId: string, data: ConstructionProjectPayload) =>
    api
      .post<ConstructionProject>(`${base}/${establishmentId}`, data)
      .then((r) => r.data),

  update: (
    establishmentId: string,
    id: string,
    data: ConstructionProjectPayload
  ) =>
    api
      .put<ConstructionProject>(`${base}/${establishmentId}/${id}`, data)
      .then((r) => r.data),

  // medicao (boletim): valor informado ou calculado pelo avanco; lanca no caixa
  measure: (
    establishmentId: string,
    id: string,
    data: { amount?: number; note?: string; date?: string; method?: string }
  ) =>
    api
      .post<ConstructionProject>(
        `${base}/${establishmentId}/${id}/measurement`,
        data
      )
      .then((r) => r.data),

  schedule: (establishmentId: string, id: string, slots: string[]) =>
    api
      .post<ScheduleResult>(`${base}/${establishmentId}/${id}/schedule`, {
        slots,
      })
      .then((r) => r.data),

  unschedule: (establishmentId: string, id: string) =>
    api
      .post<ConstructionProject>(`${base}/${establishmentId}/${id}/unschedule`, {})
      .then((r) => r.data),

  remove: (establishmentId: string, id: string) =>
    api
      .delete<{ message: string; _id: string }>(`${base}/${establishmentId}/${id}`)
      .then((r) => r.data),
};
