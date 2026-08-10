import { api } from "../lib/api";

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface ServiceEstablishment {
  _id: string;
  name: string;
  city?: string;
  phone?: string;
  address?: string;
}

export interface Service {
  _id: string;
  establishment: ServiceEstablishment;
  category: Category;
  title: string;
  description: string;
  price: number;
  durationMinutes: number;
  photos: string[];
  professionals?: string[]; // ids de quem faz; vazio/ausente = todos
  active: boolean;
}

export const catalogApi = {
  categories: () => api.get<Category[]>("/categories").then((r) => r.data),

  // busca publica de servicos; aceita filtros
  listServices: (params?: {
    establishment?: string;
    category?: string;
    q?: string;
  }) => api.get<Service[]>("/services", { params }).then((r) => r.data),

  getService: (id: string) =>
    api.get<Service>(`/services/${id}`).then((r) => r.data),

  // servicos de um estabelecimento
  byEstablishment: (establishmentId: string) =>
    api
      .get<Service[]>("/services", { params: { establishment: establishmentId } })
      .then((r) => r.data),

  createService: (data: {
    establishment: string;
    title: string;
    description: string;
    price: number;
    durationMinutes: number;
    category: string;
    professionals?: string[];
  }) => api.post<Service>("/services", data).then((r) => r.data),

  updateService: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      price: number;
      durationMinutes: number;
      category: string;
      professionals: string[];
    }>
  ) => api.put<Service>(`/services/${id}`, data).then((r) => r.data),

  deleteService: (id: string) =>
    api.delete(`/services/${id}`).then((r) => r.data),
};