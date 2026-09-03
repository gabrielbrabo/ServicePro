import { api } from "../lib/api";

// ===== Programa (config do estabelecimento) =====
export interface LoyaltyProgram {
  _id?: string;
  establishment: string;
  goal: number; // carimbos para ganhar a recompensa
  reward: string; // descricao da recompensa
  active: boolean;
  bonusStampOnReview: boolean; // avaliar da +1 carimbo
  _isNew?: boolean;
}
export interface ProgramPayload {
  goal?: number;
  reward?: string;
  active?: boolean;
  bonusStampOnReview?: boolean;
}

// ===== Cartao (por cliente) =====
export type LoyaltyAction = "carimbo" | "estorno" | "resgate" | "conquista";

export interface LoyaltyEntry {
  _id?: string;
  action: LoyaltyAction;
  date: string;
  by?: string;
}

// cliente pode vir populado (listCards) ou apenas o id (getCard)
export type LoyaltyClient =
  | string
  | { _id: string; name?: string; avatar?: string };

export interface LoyaltyCard {
  _id?: string;
  establishment: string;
  client: LoyaltyClient;
  stamps: number;
  rewardsGiven: number;
  rewardsPending: number;
  history: LoyaltyEntry[];
  createdAt?: string;
  updatedAt?: string;
  _isNew?: boolean;
}

const base = "/loyalty";

export const loyaltyApi = {
  getProgram: (establishmentId: string) =>
    api
      .get<LoyaltyProgram>(`${base}/program/${establishmentId}`)
      .then((r) => r.data),
  setProgram: (establishmentId: string, data: ProgramPayload) =>
    api
      .put<LoyaltyProgram>(`${base}/program/${establishmentId}`, data)
      .then((r) => r.data),

  listCards: (establishmentId: string) =>
    api
      .get<LoyaltyCard[]>(`${base}/${establishmentId}/cards`)
      .then((r) => r.data),
  getCard: (establishmentId: string, clientId: string) =>
    api
      .get<LoyaltyCard>(`${base}/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  addStamp: (establishmentId: string, clientId: string) =>
    api
      .post<LoyaltyCard>(`${base}/${establishmentId}/${clientId}/stamp`)
      .then((r) => r.data),
  removeStamp: (establishmentId: string, clientId: string) =>
    api
      .delete<LoyaltyCard>(`${base}/${establishmentId}/${clientId}/stamp`)
      .then((r) => r.data),
  // marca que a recompensa PENDENTE foi entregue (gera auditoria no back)
  redeem: (establishmentId: string, clientId: string) =>
    api
      .post<LoyaltyCard>(`${base}/${establishmentId}/${clientId}/redeem`)
      .then((r) => r.data),
};
