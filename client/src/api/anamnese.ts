import { api } from "../lib/api";

export interface AnamneseAnswer {
  question: string;
  answer: string;
}
export interface AnamneseSubmission {
  _id: string;
  establishment: string;
  patientName: string;
  patientPhone: string;
  answers: AnamneseAnswer[];
  createdAt: string;
}
export interface AnamneseForm {
  establishmentName: string;
  questions: string[];
}

export const anamneseApi = {
  // publico (paciente, sem login)
  publicForm: (e: string) =>
    api.get<AnamneseForm>(`/public/anamnese/${e}`).then((r) => r.data),
  submit: (
    e: string,
    data: { patientName: string; patientPhone: string; answers: AnamneseAnswer[] }
  ) => api.post<{ ok: boolean }>(`/public/anamnese/${e}`, data).then((r) => r.data),
  // protegido (dono)
  list: (e: string) =>
    api.get<AnamneseSubmission[]>(`/anamnese/${e}`).then((r) => r.data),
  remove: (e: string, id: string) =>
    api
      .delete<{ message: string; _id: string }>(`/anamnese/${e}/${id}`)
      .then((r) => r.data),
};
