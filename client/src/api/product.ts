import { api } from "../lib/api";

export interface Product {
  _id: string;
  establishment: string;
  name: string;
  description: string;
  photo: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  supplier: string;
  barcode: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const productApi = {
  list: (
    establishmentId: string,
    opts?: { all?: boolean; q?: string }
  ) =>
    api
      .get<Product[]>(`/products/${establishmentId}`, {
        params: {
          all: opts?.all ? "1" : undefined,
          q: opts?.q || undefined,
        },
      })
      .then((r) => r.data),

  create: (
    establishmentId: string,
    data: {
      name: string;
      description?: string;
      photo?: string;
      price: number;
      cost?: number;
      stock?: number;
      minStock?: number;
      supplier?: string;
      barcode?: string;
    }
  ) =>
    api
      .post<Product>(`/products/${establishmentId}`, data)
      .then((r) => r.data),

  update: (
    establishmentId: string,
    productId: string,
    data: Partial<{
      name: string;
      description: string;
      photo: string;
      price: number;
      cost: number;
      minStock: number;
      supplier: string;
      barcode: string;
      active: boolean;
    }>
  ) =>
    api
      .put<Product>(`/products/${establishmentId}/${productId}`, data)
      .then((r) => r.data),

  remove: (establishmentId: string, productId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/products/${establishmentId}/${productId}`
      )
      .then((r) => r.data),
};