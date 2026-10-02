import { api } from "../lib/api";

// Favoritos do usuario. A LISTA de estabelecimentos favoritos vem da busca:
// establishmentApi.search({ favorites: true }).
export const favoritesApi = {
  ids: () => api.get<string[]>("/favorites/ids").then((r) => r.data),
  add: (establishmentId: string) =>
    api.post(`/favorites/${establishmentId}`).then((r) => r.data),
  remove: (establishmentId: string) =>
    api.delete(`/favorites/${establishmentId}`).then((r) => r.data),
};
