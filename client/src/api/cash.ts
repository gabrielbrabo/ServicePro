import { api } from "../lib/api";

export type MovementType = "entrada" | "saida" | "sangria" | "suprimento";
export type PaymentMethod = "dinheiro" | "cartao" | "pix" | "outro";
export type CashSessionStatus = "aberto" | "fechado";

export interface ReportLine {
  type: MovementType;
  method: PaymentMethod;
  amount: number;
  description: string;
  professionalName: string | null;
  createdAt: string;
}

export interface CashReport {
  openingAmount: number;
  byMethod: { dinheiro: number; cartao: number; pix: number; outro: number };
  byType: { entrada: number; saida: number; sangria: number; suprimento: number };
  expectedCash: number;
  countedAmount: number;
  difference: number;
  totalRevenue: number;
  movementCount: number;
  lines: ReportLine[];
  generatedAt: string;
}

export interface CashSession {
  _id: string;
  establishment: string;
  openedBy: string | { _id: string; name: string };
  status: CashSessionStatus;
  openingAmount: number;
  openedAt: string;
  closedBy?: string | { _id: string; name: string };
  closedAt?: string;
  expectedAmount?: number;
  countedAmount?: number;
  difference?: number;
  closingNotes?: string;
  report?: CashReport;
}

export interface CashMovement {
  _id: string;
  session: string;
  establishment: string;
  createdBy: string | { _id: string; name: string };
  type: MovementType;
  method: PaymentMethod;
  amount: number;
  description: string;
  booking: string | null;
  professional: string | null;
  professionalName?: string | null;
  createdAt: string;
}

export interface CashTotals {
  expectedCash: number;
  byType: { entrada: number; saida: number; sangria: number; suprimento: number };
  byMethod: { dinheiro: number; cartao: number; pix: number; outro: number };
  movementCount: number;
}

export interface CurrentResponse {
  session: CashSession | null;
  totals?: CashTotals;
  movements?: CashMovement[];
}

export const cashApi = {
  current: (establishmentId: string) =>
    api
      .get<CurrentResponse>(`/cash/${establishmentId}/current`)
      .then((r) => r.data),

  open: (establishmentId: string, openingAmount: number) =>
    api
      .post<{ session: CashSession; postedCount: number }>(
        `/cash/${establishmentId}/open`,
        { openingAmount }
      )
      .then((r) => r.data),

  addMovement: (
    establishmentId: string,
    data: {
      type: MovementType;
      method: PaymentMethod;
      amount: number;
      description?: string;
    }
  ) =>
    api
      .post<{ movement: CashMovement; totals: CashTotals }>(
        `/cash/${establishmentId}/movement`,
        data
      )
      .then((r) => r.data),

  close: (
    establishmentId: string,
    data: { countedAmount: number; closingNotes?: string }
  ) =>
    api
      .post<{ session: CashSession; totals: CashTotals }>(
        `/cash/${establishmentId}/close`,
        data
      )
      .then((r) => r.data),

  history: (establishmentId: string, page = 1) =>
    api
      .get<{
        sessions: CashSession[];
        page: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
      }>(`/cash/${establishmentId}/history`, { params: { page } })
      .then((r) => r.data),

  // vende um produto: entrada no caixa + baixa no estoque
  sell: (
    establishmentId: string,
    data: {
      productId: string;
      quantity: number;
      method: PaymentMethod;
      discount?: number;
    }
  ) =>
    api
      .post<{
        movement: CashMovement;
        product: { _id: string; name: string; stock: number };
        totals: CashTotals;
        warnings: string[];
      }>(`/cash/${establishmentId}/sell`, data)
      .then((r) => r.data),
};