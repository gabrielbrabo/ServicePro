import { api } from "../lib/api";

export interface HealthPlan {
  _id: string;
  name: string;
  ansRegistry?: string;
  active: boolean;
}

export interface TussServiceRow {
  _id: string;
  title: string;
  code: string;
  description: string;
}

export interface InsuranceCard {
  _id: string;
  client: string;
  healthPlan: { _id: string; name: string } | string;
  number: string;
  validThru?: string;
  holderName?: string;
}

export type ProcedureStatus = "pendente" | "pago" | "glosado";

export interface ClaimProcedure {
  tussCode: string;
  description?: string;
  quantity: number;
  unitValue: number;
  status: ProcedureStatus;
  glosaReason?: string;
}

export interface Claim {
  _id: string;
  client: { _id: string; name: string } | string;
  healthPlan: { _id: string; name: string; ansRegistry?: string } | string;
  cardNumber?: string;
  cardValidThru?: string;
  professional?: string;
  guideNumber?: string;
  date: string;
  procedures: ClaimProcedure[];
  notes?: string;
  createdAt: string;
}

export interface ClaimInput {
  client: string;
  healthPlan: string;
  cardNumber?: string;
  cardValidThru?: string;
  guideNumber?: string;
  date?: string;
  procedures: ClaimProcedure[];
  notes?: string;
}

export interface TissConfig {
  cnpj?: string;
  cnes?: string;
  providerCode?: string;
  contractedName?: string;
  tissVersion?: string;
  profName?: string;
  councilCode?: string;
  councilNumber?: string;
  councilUF?: string;
  cbo?: string;
}

export interface TissXmlResult {
  xml: string;
  hash: string;
  warnings: string[];
}

const base = "/convenios";

export const convenioApi = {
  // convenios
  listPlans: (est: string) =>
    api.get<HealthPlan[]>(`${base}/${est}/plans`).then((r) => r.data),
  createPlan: (est: string, data: { name: string; ansRegistry?: string }) =>
    api.post<HealthPlan>(`${base}/${est}/plans`, data).then((r) => r.data),
  updatePlan: (
    est: string,
    planId: string,
    data: Partial<{ name: string; ansRegistry: string; active: boolean }>
  ) => api.put<HealthPlan>(`${base}/${est}/plans/${planId}`, data).then((r) => r.data),
  deletePlan: (est: string, planId: string) =>
    api.delete(`${base}/${est}/plans/${planId}`).then((r) => r.data),

  // codigos TUSS
  getTuss: (est: string) =>
    api
      .get<{ services: TussServiceRow[] }>(`${base}/${est}/tuss`)
      .then((r) => r.data.services),
  setTuss: (
    est: string,
    codes: { service: string; code: string; description?: string }[]
  ) => api.put<{ ok: boolean }>(`${base}/${est}/tuss`, { codes }).then((r) => r.data),

  // carteirinhas
  listCards: (est: string, client?: string) =>
    api
      .get<InsuranceCard[]>(`${base}/${est}/cards`, { params: { client } })
      .then((r) => r.data),

  // guias
  listClaims: (
    est: string,
    params?: { client?: string; healthPlan?: string; status?: string; from?: string; to?: string }
  ) => api.get<Claim[]>(`${base}/${est}/claims`, { params }).then((r) => r.data),
  createClaim: (est: string, data: ClaimInput) =>
    api.post<Claim>(`${base}/${est}/claims`, data).then((r) => r.data),
  updateClaim: (est: string, claimId: string, data: Partial<ClaimInput>) =>
    api.put<Claim>(`${base}/${est}/claims/${claimId}`, data).then((r) => r.data),
  deleteClaim: (est: string, claimId: string) =>
    api.delete(`${base}/${est}/claims/${claimId}`).then((r) => r.data),

  // TISS (Fase 2)
  getTissConfig: (est: string) =>
    api.get<TissConfig>(`${base}/${est}/tiss-config`).then((r) => r.data),
  setTissConfig: (est: string, data: TissConfig) =>
    api.put<TissConfig>(`${base}/${est}/tiss-config`, data).then((r) => r.data),
  generateXml: (est: string, claimId: string) =>
    api
      .get<TissXmlResult>(`${base}/${est}/claims/${claimId}/tiss-xml`)
      .then((r) => r.data),
  generateSadtXml: (est: string, claimId: string) =>
    api
      .get<TissXmlResult>(`${base}/${est}/claims/${claimId}/tiss-sadt-xml`)
      .then((r) => r.data),
};
