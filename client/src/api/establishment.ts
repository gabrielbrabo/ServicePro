import { api } from "../lib/api";
import { Category } from "./catalog";

export interface Member {
  professional: { _id: string; name: string; avatar?: string } | string;
  role: "owner" | "professional";
  active: boolean;
}

export interface Address {
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
}

// atendimento a domicilio (padrao do estabelecimento)
export interface HomeService {
  enabled: boolean;
  avgSpeedKmh: number; // velocidade media p/ estimar o deslocamento
  baseFee: number; // taxa fixa de deslocamento (R$)
  feePerKm: number; // taxa por km rodado, ida e volta (R$)
  maxRadiusKm: number; // distancia maxima atendida (0 = sem limite)
}

export interface Establishment {
  _id: string;
  owner: string | { _id: string; name: string; avatar?: string };
  category: Category;
  name: string;
  description?: string;
  phone?: string;
  address: Address;
  // area do estabelecimento (define os modulos/ferramentas liberados)
  segment?: "geral" | "beleza" | "saude";
  location?: { type: string; coordinates: [number, number] };
  photo?: string;
  coverPhotos?: string[];
  members: Member[];
  active: boolean;
  cashAutoEntry?: boolean;
  homeService?: HomeService; // atendimento a domicilio (padrao do estab.)
  // nota agregada (sistema de avaliacao). Vem no proprio doc do estabelecimento.
  ratingAvg?: number;
  ratingCount?: number;
  // serviços do estabelecimento (preenchido por /establishments/:id via getById)
  services?: EstablishmentService[];
  // preenchidos por /establishments/mine — indicam o papel do user logado
  myRole?: "owner" | "professional";
  myProfessionalId?: string | null;
}

export interface EstablishmentSearchResult {
  items: Establishment[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface SearchFilters {
  category?: string;
  q?: string; // nome do estabelecimento
  city?: string; // localização
  service?: string; // nome do serviço oferecido
  page?: number;
  userCity?: string; // cidade do usuário logado (prioriza resultados)
  userState?: string; // estado do usuário logado
  // busca por raio (opcional): posicao atual do usuario + raio em km
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export const establishmentApi = {
  mine: () =>
    api.get<Establishment[]>("/establishments/mine").then((r) => r.data),

  getOne: (id: string) =>
    api.get<Establishment>(`/establishments/${id}`).then((r) => r.data),

  search: (filters: SearchFilters) =>
    api
      .get<EstablishmentSearchResult>("/establishments/search", {
        params: {
          category: filters.category || undefined,
          q: filters.q || undefined,
          city: filters.city || undefined,
          service: filters.service || undefined,
          page: filters.page || 1,
          userCity: filters.userCity || undefined,
          userState: filters.userState || undefined,
          // enviados so quando ha busca por raio ativa.
          // usa ?? para nao descartar lat/lng = 0 (valores validos).
          lat: filters.lat ?? undefined,
          lng: filters.lng ?? undefined,
          radiusKm: filters.radiusKm ?? undefined,
        },
      })
      .then((r) => r.data),

  create: (data: {
    name: string;
    category: string;
    segment?: "geral" | "beleza" | "saude";
    description?: string;
    phone?: string;
    address: Address;
    location?: { type: string; coordinates: [number, number] };
  }) => api.post<Establishment>("/establishments", data).then((r) => r.data),

  update: (
    id: string,
    // category vai como id (string); os demais campos seguem o modelo
    data: Partial<Omit<Establishment, "category">> & { category?: string }
  ) => api.put<Establishment>(`/establishments/${id}`, data).then((r) => r.data),

  // busca um estabelecimento por id, com seus serviços
  getById: (id: string) =>
    api
      .get<Establishment>(`/establishments/${id}`)
      .then((r) => r.data),
};

export interface EstablishmentService {
  _id: string;
  title: string;
  description?: string;
  price: number;
  durationMinutes: number;
}