import { api } from "../lib/api";

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  // area a que a categoria pertence (para filtrar no cadastro por area)
  segment?: "geral" | "beleza" | "saude";
}

export interface ServiceEstablishment {
  _id: string;
  name: string;
  city?: string;
  phone?: string;
  address?: string;
}

export interface ProfessionalDuration {
  professional: string;
  durationMinutes: number;
}

export interface Service {
  _id: string;
  establishment: ServiceEstablishment;
  category: Category;
  title: string;
  description: string;
  price: number;
  durationMinutes: number; // duracao TOTAL (inclui a pausa de processamento)
  bufferMinutes?: number; // folga apos o atendimento
  processingGapAfter?: number; // min de trabalho ate a pausa (0 = sem pausa)
  processingGapMinutes?: number; // duracao da pausa (prof. fica livre)
  depositType?: "none" | "percent" | "fixed"; // sinal exigido ao agendar
  depositValue?: number; // % (percent) ou R$ (fixed)
  serviceMode?: "local" | "domicilio" | "ambos"; // modalidade de atendimento
  homeBaseFee?: number | null; // override da taxa fixa (null = padrao do estab.)
  homeFeePerKm?: number | null; // override da taxa por km (null = padrao)
  professionalDurations?: ProfessionalDuration[]; // override de duracao por prof.
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
    bufferMinutes?: number;
    processingGapAfter?: number;
    processingGapMinutes?: number;
    depositType?: "none" | "percent" | "fixed";
    depositValue?: number;
    serviceMode?: "local" | "domicilio" | "ambos";
    homeBaseFee?: number | null;
    homeFeePerKm?: number | null;
    professionalDurations?: ProfessionalDuration[];
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
      bufferMinutes: number;
      processingGapAfter: number;
      processingGapMinutes: number;
      depositType: "none" | "percent" | "fixed";
      depositValue: number;
      serviceMode: "local" | "domicilio" | "ambos";
      homeBaseFee: number | null;
      homeFeePerKm: number | null;
      professionalDurations: ProfessionalDuration[];
    }>
  ) => api.put<Service>(`/services/${id}`, data).then((r) => r.data),

  deleteService: (id: string) =>
    api.delete(`/services/${id}`).then((r) => r.data),
};