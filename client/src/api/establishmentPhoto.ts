import { api } from "../lib/api";

export interface EstablishmentPhotos {
  photo: string;
  coverPhotos: string[];
}

export interface PhotosResponse extends EstablishmentPhotos {
  message: string;
}

export const establishmentPhotoApi = {
  // fotos do estabelecimento (publico)
  get: (establishmentId: string) =>
    api
      .get<EstablishmentPhotos>(`/establishments/${establishmentId}/photos`)
      .then((r) => r.data),

  // foto de perfil / logo. Envie "" para remover. (protegido, dono)
  updateProfile: (establishmentId: string, photo: string) =>
    api
      .put<PhotosResponse>(
        `/establishments/${establishmentId}/photos/profile`,
        { photo }
      )
      .then((r) => r.data),

  // substitui a lista inteira de capas: adicionar, remover e reordenar
  // usam este mesmo endpoint. (protegido, dono)
  updateCovers: (establishmentId: string, coverPhotos: string[]) =>
    api
      .put<PhotosResponse>(
        `/establishments/${establishmentId}/photos/covers`,
        { coverPhotos }
      )
      .then((r) => r.data),
};