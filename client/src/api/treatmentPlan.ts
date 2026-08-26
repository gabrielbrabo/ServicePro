import { api } from "../lib/api";

export interface TreatmentItem {
  _id: string;
  description: string;
  price: number;
  done: boolean;
  doneAt?: string;
}

export type TreatmentStatus = "aberto" | "concluido" | "cancelado";

export interface TreatmentPlan {
  _id: string;
  establishment: string;
  client: string;
  title: string;
  items: TreatmentItem[];
  discount: number;
  installments: number;
  status: TreatmentStatus;
  createdAt: string;
  updatedAt: string;
}

const base = "/treatment-plans";

export const treatmentPlanApi = {
  list: (establishmentId: string, clientId: string) =>
    api
      .get<TreatmentPlan[]>(`${base}/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  create: (
    establishmentId: string,
    clientId: string,
    data: {
      title?: string;
      items?: { description: string; price: number }[];
      discount?: number;
      installments?: number;
    }
  ) =>
    api
      .post<TreatmentPlan>(`${base}/${establishmentId}/${clientId}`, data)
      .then((r) => r.data),

  update: (
    establishmentId: string,
    planId: string,
    data: {
      title?: string;
      discount?: number;
      installments?: number;
      status?: TreatmentStatus;
    }
  ) =>
    api
      .put<TreatmentPlan>(`${base}/${establishmentId}/plans/${planId}`, data)
      .then((r) => r.data),

  remove: (establishmentId: string, planId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/plans/${planId}`
      )
      .then((r) => r.data),

  addItem: (
    establishmentId: string,
    planId: string,
    data: { description: string; price: number }
  ) =>
    api
      .post<TreatmentPlan>(
        `${base}/${establishmentId}/plans/${planId}/items`,
        data
      )
      .then((r) => r.data),

  updateItem: (
    establishmentId: string,
    planId: string,
    itemId: string,
    data: { description?: string; price?: number; done?: boolean }
  ) =>
    api
      .patch<TreatmentPlan>(
        `${base}/${establishmentId}/plans/${planId}/items/${itemId}`,
        data
      )
      .then((r) => r.data),

  deleteItem: (establishmentId: string, planId: string, itemId: string) =>
    api
      .delete<TreatmentPlan>(
        `${base}/${establishmentId}/plans/${planId}/items/${itemId}`
      )
      .then((r) => r.data),
};