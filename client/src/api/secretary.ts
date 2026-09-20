import { api } from "../lib/api";

// Secretária(o)/atendente: login que organiza a agenda de todos, sem prestar
// serviço nem ter poderes de dono. A 1a é grátis; extras contam como assento.

export interface SecretaryMember {
  userId: string;
  name: string;
  email: string;
  active: boolean;
}

export interface SecretaryPending {
  _id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

export interface SecretaryListResult {
  secretaries: SecretaryMember[];
  pending: SecretaryPending[];
}

export interface InviteSecretaryResult {
  message: string;
  emailSent: boolean;
  inviteUrl: string;
  expiresAt: string;
}

export const secretaryApi = {
  list: (establishmentId: string) =>
    api
      .get<SecretaryListResult>(`/establishments/${establishmentId}/secretaries`)
      .then((r) => r.data),

  invite: (establishmentId: string, email: string) =>
    api
      .post<InviteSecretaryResult>(
        `/establishments/${establishmentId}/secretaries/invite`,
        { email }
      )
      .then((r) => r.data),

  remove: (establishmentId: string, userId: string) =>
    api
      .delete<{ message: string; userId: string }>(
        `/establishments/${establishmentId}/secretaries/${userId}`
      )
      .then((r) => r.data),
};
