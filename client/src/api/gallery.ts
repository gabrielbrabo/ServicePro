import { api } from "../lib/api";

export interface GalleryItem {
  _id: string;
  establishment: string;
  beforeUrl: string;
  afterUrl: string;
  title: string;
  description: string;
  professional: string | null;
  professionalName?: string | null;
  service: string | { _id: string; title: string } | null;
  active: boolean;
  createdAt: string;
}

export const galleryApi = {
  // listagem publica; all=true (dono/equipe) inclui inativos
  list: (establishmentId: string, all = false) =>
    api
      .get<GalleryItem[]>(`/gallery/${establishmentId}`, {
        params: all ? { all: "1" } : undefined,
      })
      .then((r) => r.data),

  create: (
    establishmentId: string,
    data: {
      beforeUrl: string;
      afterUrl: string;
      title?: string;
      description?: string;
      professionalId?: string | null;
      serviceId?: string | null;
    }
  ) =>
    api
      .post<GalleryItem>(`/gallery/${establishmentId}`, data)
      .then((r) => r.data),

  update: (
    establishmentId: string,
    itemId: string,
    data: {
      title?: string;
      description?: string;
      professionalId?: string | null;
      serviceId?: string | null;
      active?: boolean;
    }
  ) =>
    api
      .put<GalleryItem>(`/gallery/${establishmentId}/${itemId}`, data)
      .then((r) => r.data),

  remove: (establishmentId: string, itemId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/gallery/${establishmentId}/${itemId}`
      )
      .then((r) => r.data),
};