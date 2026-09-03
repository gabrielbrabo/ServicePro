import { api } from "../lib/api";

export type MaintenanceFrequency =
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "personalizada";

export interface MaintenanceTask {
  name: string;
}

export interface MaintenancePlan {
  _id: string;
  establishment: string;
  client: string | null;
  clientName: string;
  clientPhone: string;
  location: string;
  frequency: MaintenanceFrequency;
  frequencyNote: string;
  active: boolean;
  service: string | null;
  professional: string | null;
  startDate: string;
  time: string;
  visitsCount: number;
  seriesId: string | null;
  tasks: MaintenanceTask[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type MaintenancePlanPayload = Partial<
  Omit<
    MaintenancePlan,
    "_id" | "establishment" | "seriesId" | "createdAt" | "updatedAt"
  >
>;

export interface ScheduleResult {
  plan: MaintenancePlan;
  seriesId: string;
  createdCount: number;
  skippedCount: number;
  skipped: { date: string; reason: string }[];
}

export const maintenancePlanApi = {
  list: (establishmentId: string) =>
    api
      .get<MaintenancePlan[]>(`/maintenance-plans/${establishmentId}`)
      .then((r) => r.data),

  create: (establishmentId: string, data: MaintenancePlanPayload) =>
    api
      .post<MaintenancePlan>(`/maintenance-plans/${establishmentId}`, data)
      .then((r) => r.data),

  update: (establishmentId: string, id: string, data: MaintenancePlanPayload) =>
    api
      .put<MaintenancePlan>(`/maintenance-plans/${establishmentId}/${id}`, data)
      .then((r) => r.data),

  // gera as visitas na agenda; `slots` = datas/horarios (ISO) calculados pela
  // frequencia no cliente
  schedule: (establishmentId: string, id: string, slots: string[]) =>
    api
      .post<ScheduleResult>(
        `/maintenance-plans/${establishmentId}/${id}/schedule`,
        { slots }
      )
      .then((r) => r.data),

  // cancela as visitas futuras da serie e desvincula o plano
  unschedule: (establishmentId: string, id: string) =>
    api
      .post<MaintenancePlan>(
        `/maintenance-plans/${establishmentId}/${id}/unschedule`,
        {}
      )
      .then((r) => r.data),

  remove: (establishmentId: string, id: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/maintenance-plans/${establishmentId}/${id}`
      )
      .then((r) => r.data),
};
