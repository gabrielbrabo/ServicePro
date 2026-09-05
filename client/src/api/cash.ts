import { api } from "../lib/api";

export type MovementType = "entrada" | "saida" | "sangria" | "suprimento";
export type PaymentMethod = "dinheiro" | "cartao" | "pix" | "outro";
export type CashSessionStatus = "aberto" | "fechado";
export type MovementStatus = "ativo" | "estornado";

export interface CashItem {
  kind: "servico" | "produto" | "avulso";
  refId?: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface CashPayment {
  method: PaymentMethod;
  amount: number;
}

export interface ReportLine {
  type: MovementType;
  method: PaymentMethod;
  amount: number;
  description: string;
  clientName?: string;
  professionalName: string | null;
  createdAt: string;
}

export interface Denomination {
  value: number;
  qty: number;
}

export interface CashReport {
  openingAmount: number;
  byMethod: { dinheiro: number; cartao: number; pix: number; outro: number };
  byType: { entrada: number; saida: number; sangria: number; suprimento: number };
  expectedCash: number;
  countedAmount: number;
  difference: number;
  totalRevenue: number;
  fees?: number;
  discounts?: number;
  movementCount: number;
  countedBreakdown?: Denomination[];
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
  items?: CashItem[];
  payments?: CashPayment[];
  discount?: number;
  fee?: number;
  client?: string | null;
  clientName?: string;
  status?: MovementStatus;
  voidReason?: string;
  receivable?: boolean;
  paid?: boolean;
  dueDate?: string | null;
  createdAt: string;
}

export interface CashTotals {
  expectedCash: number;
  byType: { entrada: number; saida: number; sangria: number; suprimento: number };
  byMethod: { dinheiro: number; cartao: number; pix: number; outro: number };
  fees?: number;
  discounts?: number;
  movementCount: number;
}

export interface CurrentResponse {
  session: CashSession | null;
  totals?: CashTotals;
  movements?: CashMovement[];
}

export interface SaleItemInput {
  kind: "servico" | "produto" | "avulso";
  refId?: string | null;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface SaleInput {
  items: SaleItemInput[];
  discount?: number;
  fee?: number;
  payments?: CashPayment[];
  receivable?: boolean;
  dueDate?: string;
  clientId?: string;
  clientName?: string;
  professionalId?: string;
  note?: string;
}

export interface DashboardData {
  from: string;
  to: string;
  revenue: number;
  netRevenue: number;
  salesCount: number;
  ticket: number;
  outflow: number;
  fees: number;
  discounts: number;
  byMethod: { dinheiro: number; cartao: number; pix: number; outro: number };
  byDay: { date: string; total: number }[];
  byProfessional: { name: string; total: number; count: number }[];
  topItems: { name: string; kind: string; qty: number; total: number }[];
  receivables: { total: number; count: number };
}

export interface Receivable {
  _id: string;
  description: string;
  clientName: string;
  amount: number;
  dueDate: string | null;
  createdAt: string;
}

export interface MovementFilters {
  from?: string;
  to?: string;
  type?: string;
  method?: string;
  professional?: string;
  q?: string;
  page?: number;
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
      professionalId?: string;
    }
  ) =>
    api
      .post<{ movement: CashMovement; totals: CashTotals }>(
        `/cash/${establishmentId}/movement`,
        data
      )
      .then((r) => r.data),

  // venda / comanda (vários itens, split, fiado)
  sale: (establishmentId: string, data: SaleInput) =>
    api
      .post<{
        movement: CashMovement;
        totals: CashTotals;
        updatedProducts: { _id: string; name: string; stock: number }[];
        warnings: string[];
      }>(`/cash/${establishmentId}/sale`, data)
      .then((r) => r.data),

  void: (establishmentId: string, movementId: string, reason: string) =>
    api
      .post<{ movement: CashMovement; totals: CashTotals }>(
        `/cash/${establishmentId}/movement/${movementId}/void`,
        { reason }
      )
      .then((r) => r.data),

  receive: (
    establishmentId: string,
    movementId: string,
    payments?: CashPayment[]
  ) =>
    api
      .post<{ movement: CashMovement; totals: CashTotals }>(
        `/cash/${establishmentId}/movement/${movementId}/receive`,
        { payments }
      )
      .then((r) => r.data),

  close: (
    establishmentId: string,
    data: {
      countedAmount: number;
      closingNotes?: string;
      countedBreakdown?: Denomination[];
    }
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

  movements: (establishmentId: string, filters: MovementFilters = {}) =>
    api
      .get<{
        movements: CashMovement[];
        page: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
      }>(`/cash/${establishmentId}/movements`, { params: filters })
      .then((r) => r.data),

  receivables: (establishmentId: string) =>
    api
      .get<{ items: Receivable[]; total: number; count: number }>(
        `/cash/${establishmentId}/receivables`
      )
      .then((r) => r.data),

  dashboard: (
    establishmentId: string,
    params?: { from?: string; to?: string }
  ) =>
    api
      .get<DashboardData>(`/cash/${establishmentId}/dashboard`, { params })
      .then((r) => r.data),

  // recibo em PDF (blob) — abrir/baixar
  receipt: (establishmentId: string, movementId: string) =>
    api
      .get<Blob>(`/cash/${establishmentId}/movement/${movementId}/receipt`, {
        responseType: "blob",
      })
      .then((r) => r.data),

  // compat: venda rápida de 1 produto
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
