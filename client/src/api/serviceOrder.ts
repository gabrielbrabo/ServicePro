import { api } from "../lib/api";

export type OrderStatus =
  | "orcamento"
  | "aprovado"
  | "em_execucao"
  | "concluido"
  | "entregue"
  | "cancelado";

export interface OrderPart {
  description: string;
  qty: number;
  unitPrice: number;
}

export type InspectionStatus = "ok" | "atencao" | "troca" | "na";
export interface InspectionItem {
  item: string;
  status: InspectionStatus;
  note: string;
}
export interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  year: number;
  km: number;
  color: string;
}
export interface Equipment {
  brand: string;
  model: string;
  serial: string;
  accessories: string;
  condition: string;
}
export interface PestControl {
  targetPest: string;
  products: string;
  method: string;
  nextApplication: string;
  technician: string;
}

export interface ServiceOrder {
  _id: string;
  establishment: string;
  number: number;
  clientName: string;
  clientPhone: string;
  professional?: string | null;
  title: string;
  object: string;
  reportedProblem: string;
  diagnosis: string;
  parts: OrderPart[];
  laborCost: number;
  discount: number;
  total: number;
  status: OrderStatus;
  warrantyDays: number;
  warrantyNote: string;
  photosBefore: string[];
  photosAfter: string[];
  notes: string;
  vehicle?: Vehicle;
  inspection?: InspectionItem[];
  equipment?: Equipment;
  technicalReport?: string;
  pestControl?: PestControl;
  paymentMethod?: "dinheiro" | "cartao" | "pix" | "outro";
  postedToCash?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderPayload = Partial<
  Omit<ServiceOrder, "_id" | "establishment" | "number" | "createdAt" | "updatedAt" | "total">
>;

export const serviceOrderApi = {
  list: (establishmentId: string) =>
    api
      .get<ServiceOrder[]>(`/service-orders/${establishmentId}`)
      .then((r) => r.data),

  create: (establishmentId: string, data: OrderPayload) =>
    api
      .post<ServiceOrder>(`/service-orders/${establishmentId}`, data)
      .then((r) => r.data),

  update: (establishmentId: string, id: string, data: OrderPayload) =>
    api
      .put<ServiceOrder>(`/service-orders/${establishmentId}/${id}`, data)
      .then((r) => r.data),

  remove: (establishmentId: string, id: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/service-orders/${establishmentId}/${id}`
      )
      .then((r) => r.data),

  // PDF da OS (para imprimir ou enviar ao cliente)
  pdf: (establishmentId: string, id: string) =>
    api
      .get<Blob>(`/service-orders/${establishmentId}/${id}/pdf`, {
        responseType: "blob",
      })
      .then((r) => r.data),
};
