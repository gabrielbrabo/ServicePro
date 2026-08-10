import { api } from "../lib/api";

export interface RecordNote {
  _id: string;
  text: string;
  author: string | { _id: string; name: string };
  createdAt: string;
}

export interface MedicalRecord {
  _id?: string;
  establishment: string;
  client: string;
  allergies: string;
  medications: string;
  observations: string;
  notes: RecordNote[];
  _isNew?: boolean;
}

export interface EstablishmentClient {
  _id: string;
  name: string;
  avatar?: string;
  bookingCount: number;
  lastBooking: string;
}

export interface ClientHistoryItem {
  _id: string;
  scheduledAt: string;
  completedAt: string | null;
  serviceTitle: string;
  professionalName: string | null;
  amount: number;
  method: string;
}

export const recordApi = {
  // clientes distintos que agendaram no estabelecimento
  clients: (establishmentId: string) =>
    api
      .get<EstablishmentClient[]>(`/bookings/clients/${establishmentId}`)
      .then((r) => r.data),

  // atendimentos concluídos de um cliente neste estabelecimento
  history: (establishmentId: string, clientId: string) =>
    api
      .get<ClientHistoryItem[]>(
        `/bookings/history/${establishmentId}/${clientId}`
      )
      .then((r) => r.data),

  get: (establishmentId: string, clientId: string) =>
    api
      .get<MedicalRecord>(`/records/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  update: (
    establishmentId: string,
    clientId: string,
    data: { allergies?: string; medications?: string; observations?: string }
  ) =>
    api
      .put<MedicalRecord>(`/records/${establishmentId}/${clientId}`, data)
      .then((r) => r.data),

  addNote: (establishmentId: string, clientId: string, text: string) =>
    api
      .post<MedicalRecord>(`/records/${establishmentId}/${clientId}/notes`, {
        text,
      })
      .then((r) => r.data),

  deleteNote: (establishmentId: string, clientId: string, noteId: string) =>
    api
      .delete<MedicalRecord>(
        `/records/${establishmentId}/${clientId}/notes/${noteId}`
      )
      .then((r) => r.data),
};