import { api } from "../lib/api";
import { Product } from "./product";

export type StockMovementType = "entrada" | "saida" | "inventario";

export interface StockMovement {
  _id: string;
  establishment: string;
  product: string | { _id: string; name: string; photo?: string };
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  unitCost: number;
  createdBy: string | { _id: string; name: string };
  createdAt: string;
}

export const stockApi = {
  // historico de um produto
  byProduct: (establishmentId: string, productId: string, limit = 50) =>
    api
      .get<StockMovement[]>(`/stock/${establishmentId}/${productId}`, {
        params: { limit },
      })
      .then((r) => r.data),

  // movimentacoes recentes de todos os produtos
  all: (establishmentId: string, limit = 50) =>
    api
      .get<StockMovement[]>(`/stock/${establishmentId}`, { params: { limit } })
      .then((r) => r.data),

  create: (
    establishmentId: string,
    productId: string,
    data: {
      type: StockMovementType;
      quantity: number;
      reason?: string;
      unitCost?: number;
    }
  ) =>
    api
      .post<{
        movement: StockMovement;
        product: Product;
        warnings: string[];
      }>(`/stock/${establishmentId}/${productId}`, data)
      .then((r) => r.data),
};