import { api } from "../lib/api";

export interface ToothFace {
  face: string; // V | O | M | D | L
  status: string;
}

export interface ToothMark {
  number: number;
  status?: string; // condicao do dente inteiro (opcional)
  note?: string;
  faces?: ToothFace[];
}

export interface Odontogram {
  _id?: string;
  establishment: string;
  client: string;
  teeth: ToothMark[];
  _isNew?: boolean;
}

export interface ToothStatusDef {
  key: string;
  label: string;
  color: string; // hex #rrggbb
}

export interface StatusesResponse {
  statuses: ToothStatusDef[];
  isDefault: boolean;
}

const base = "/odontogram";

export const odontogramApi = {
  get: (establishmentId: string, clientId: string) =>
    api
      .get<Odontogram>(`${base}/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  // status para o dente inteiro (sem face) ou para uma face (V|O|M|D|L)
  setTooth: (
    establishmentId: string,
    clientId: string,
    data: { number: number; status: string; face?: string; note?: string }
  ) =>
    api
      .put<Odontogram>(`${base}/${establishmentId}/${clientId}/tooth`, data)
      .then((r) => r.data),

  // lista de status da clinica (personalizada ou padrao)
  getStatuses: (establishmentId: string) =>
    api
      .get<StatusesResponse>(`${base}/${establishmentId}/statuses`)
      .then((r) => r.data),

  // salva a lista personalizada; passe statuses:null para voltar ao padrao
  setStatuses: (
    establishmentId: string,
    statuses: ToothStatusDef[] | null
  ) =>
    api
      .put<StatusesResponse>(`${base}/${establishmentId}/statuses`, { statuses })
      .then((r) => r.data),
};