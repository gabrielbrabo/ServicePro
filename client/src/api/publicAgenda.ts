import { api } from "../lib/api";

// Bloco de hora do expediente (livre ou ocupado)
export interface AgendaSlot {
  t: string; // "09:00"
  free: boolean; // true = livre; false = ocupado
}

export interface AgendaDay {
  date: string; // YYYY-MM-DD
  dow: number; // 0=domingo ... 6=sabado
  working: boolean; // tem expediente nesse dia
  slots: AgendaSlot[]; // blocos de hora do dia
}

export interface AgendaMonth {
  establishmentName: string;
  professionalName: string | null;
  photo?: string; // foto do profissional (se houver) ou do estabelecimento
  month: string; // YYYY-MM
  days: AgendaDay[];
}

export const publicAgendaApi = {
  // agenda publica de divulgacao do mes. prof opcional (agenda do profissional);
  // mes opcional no formato YYYY-MM (padrao = mes atual).
  get: (
    establishmentId: string,
    opts?: { prof?: string | null; mes?: string }
  ) =>
    api
      .get<AgendaMonth>(`/public/agenda/${establishmentId}`, {
        params: {
          ...(opts?.prof ? { prof: opts.prof } : {}),
          ...(opts?.mes ? { mes: opts.mes } : {}),
        },
      })
      .then((r) => r.data),

  // URL da foto servida pelo backend (CORS-safe) para desenhar no banner
  photoUrl: (establishmentId: string, prof?: string | null): string =>
    `${api.defaults.baseURL}/public/agenda/${establishmentId}/photo${
      prof ? `?prof=${prof}` : ""
    }`,
};
