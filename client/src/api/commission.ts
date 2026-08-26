import { api } from "../lib/api";

export interface CommissionService {
  _id: string;
  title: string;
  price: number;
  percent: number;
}

export interface CommissionRow {
  professionalId: string | null;
  name: string;
  count: number;
  base: number;
  commission: number;
}

export interface CommissionReport {
  from: string;
  to: string;
  professionals: CommissionRow[];
  totals: { count: number; base: number; commission: number };
}

const base = "/commissions";

export const commissionApi = {
  getConfig: (establishmentId: string) =>
    api
      .get<{ services: CommissionService[] }>(`${base}/${establishmentId}/config`)
      .then((r) => r.data.services),

  setConfig: (
    establishmentId: string,
    rates: { service: string; percent: number }[]
  ) =>
    api
      .put<{ ok: boolean }>(`${base}/${establishmentId}/config`, { rates })
      .then((r) => r.data),

  getReport: (
    establishmentId: string,
    params?: { from?: string; to?: string }
  ) =>
    api
      .get<CommissionReport>(`${base}/${establishmentId}/report`, { params })
      .then((r) => r.data),
};