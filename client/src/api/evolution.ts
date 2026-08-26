import { api } from "../lib/api";

// Evolucao clinica no formato SOAP (subjetivo/objetivo/avaliacao/plano).
// Varias por paciente (uma por atendimento). Ver server: models/Evolution.ts.
export interface EvolutionCid {
  code: string;
  description: string;
}

export interface Evolution {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  booking?: string | null;
  date: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  cids: EvolutionCid[];
  createdAt: string;
  updatedAt: string;
}

export interface EvolutionPayload {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  date?: string;
  bookingId?: string | null;
  cids?: EvolutionCid[];
}

const base = "/evolutions";

export const evolutionApi = {
  list: (establishmentId: string, clientId: string) =>
    api
      .get<Evolution[]>(`${base}/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  create: (establishmentId: string, clientId: string, data: EvolutionPayload) =>
    api
      .post<Evolution>(`${base}/${establishmentId}/${clientId}`, data)
      .then((r) => r.data),

  update: (
    establishmentId: string,
    clientId: string,
    evolutionId: string,
    data: EvolutionPayload
  ) =>
    api
      .put<Evolution>(
        `${base}/${establishmentId}/${clientId}/${evolutionId}`,
        data
      )
      .then((r) => r.data),

  remove: (establishmentId: string, clientId: string, evolutionId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/${clientId}/${evolutionId}`
      )
      .then((r) => r.data),
};
