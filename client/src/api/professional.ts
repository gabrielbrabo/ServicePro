import { api } from "../lib/api";

export interface Professional {
  _id: string;
  name: string;
  photo?: string;
  specialties: string[];
  active: boolean;
  linkedUser: string | null;
}

export const professionalApi = {
  // lista os ativos (publico). all=true traz inativos tambem (so dono)
  list: (establishmentId: string, all = false) =>
    api
      .get<Professional[]>(
        `/establishments/${establishmentId}/professionals`,
        { params: all ? { all: "1" } : undefined }
      )
      .then((r) => r.data),

  add: (
    establishmentId: string,
    data: { name: string; photo?: string; specialties?: string[] }
  ) =>
    api
      .post<Professional>(
        `/establishments/${establishmentId}/professionals`,
        data
      )
      .then((r) => r.data),

  update: (
    establishmentId: string,
    professionalId: string,
    data: {
      name?: string;
      photo?: string;
      specialties?: string[];
      active?: boolean;
    }
  ) =>
    api
      .put<Professional>(
        `/establishments/${establishmentId}/professionals/${professionalId}`,
        data
      )
      .then((r) => r.data),

  remove: (establishmentId: string, professionalId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/establishments/${establishmentId}/professionals/${professionalId}`
      )
      .then((r) => r.data),
};