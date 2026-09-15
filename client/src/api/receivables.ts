import { api } from "../lib/api";

export interface ReceivablesStatus {
  configured: boolean;
  paymentsEnabled: boolean;
  // nome de outro estabelecimento do dono com conta ja configurada (reaproveitar)
  reusableFrom?: string | null;
}

export interface ReceivablesPayload {
  cpfCnpj: string;
  email: string;
  mobilePhone: string;
  postalCode: string;
  incomeValue: number;
  birthDate?: string;
  companyType?: string;
}

const base = "/establishments";

export const receivablesApi = {
  get: (establishmentId: string) =>
    api
      .get<ReceivablesStatus>(`${base}/${establishmentId}/receivables`)
      .then((r) => r.data),
  setup: (establishmentId: string, data: ReceivablesPayload) =>
    api
      .post<{ configured: boolean }>(
        `${base}/${establishmentId}/receivables`,
        data
      )
      .then((r) => r.data),
  // reaproveita a conta ja configurada em outro estabelecimento do dono
  reuse: (establishmentId: string) =>
    api
      .post<{ configured: boolean; reused?: boolean }>(
        `${base}/${establishmentId}/receivables`,
        { reuse: true }
      )
      .then((r) => r.data),
};
