import { api } from "../lib/api";

export interface ServiceItem {
  _id: string;
  establishment: string | { _id: string; name: string };
  category: string | { _id: string; name: string; icon?: string };
  title: string;
  description: string;
  price: number;
  durationMinutes: number;
  photos: string[];
  professionals?: string[]; // ids de quem faz; vazio/ausente = todos
  active: boolean;
}

export const serviceApi = {
  // serviços ativos de um estabelecimento (busca pública)
  listByEstablishment: (establishmentId: string) =>
    api
      .get<ServiceItem[]>("/services", {
        params: { establishment: establishmentId },
      })
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<ServiceItem>(`/services/${id}`).then((r) => r.data),
};