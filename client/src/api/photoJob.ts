import { api } from "../lib/api";

export type PhotoJobStatus =
  | "orcamento"
  | "contratado"
  | "em_producao"
  | "entregue"
  | "cancelado";

export interface PhotoJob {
  _id: string;
  establishment: string;
  number: number;
  clientName: string;
  clientPhone: string;
  title: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  location: string;
  briefing: string;
  deliverables: string;
  deliveryDeadline: string;
  price: number;
  deposit: number;
  paymentMethod: "dinheiro" | "cartao" | "pix" | "outro";
  contractTerms: string;
  status: PhotoJobStatus;
  deliveryLink: string;
  depositPostedToCash?: boolean;
  balancePostedToCash?: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PhotoJobPayload = Partial<
  Omit<
    PhotoJob,
    | "_id"
    | "establishment"
    | "number"
    | "depositPostedToCash"
    | "balancePostedToCash"
    | "createdAt"
    | "updatedAt"
  >
>;

export const photoJobApi = {
  list: (establishmentId: string) =>
    api
      .get<PhotoJob[]>(`/photo-jobs/${establishmentId}`)
      .then((r) => r.data),

  create: (establishmentId: string, data: PhotoJobPayload) =>
    api
      .post<PhotoJob>(`/photo-jobs/${establishmentId}`, data)
      .then((r) => r.data),

  update: (establishmentId: string, id: string, data: PhotoJobPayload) =>
    api
      .put<PhotoJob>(`/photo-jobs/${establishmentId}/${id}`, data)
      .then((r) => r.data),

  remove: (establishmentId: string, id: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/photo-jobs/${establishmentId}/${id}`
      )
      .then((r) => r.data),

  pdf: (establishmentId: string, id: string) =>
    api
      .get<Blob>(`/photo-jobs/${establishmentId}/${id}/pdf`, {
        responseType: "blob",
      })
      .then((r) => r.data),
};
