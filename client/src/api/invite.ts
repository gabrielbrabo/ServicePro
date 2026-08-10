import { api } from "../lib/api";

export interface InviteInfo {
  email: string;
  establishmentName: string;
  professionalName: string;
  hasAccount: boolean;
  userName: string;
}

export interface CreateInviteResult {
  message: string;
  emailSent: boolean;
  inviteUrl: string;
  expiresAt: string;
}

export interface AcceptInviteResult {
  message: string;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    state?: string;
    city?: string;
  };
}

export const inviteApi = {
  // dono cria o convite para um profissional
  create: (establishmentId: string, professionalId: string, email: string) =>
    api
      .post<CreateInviteResult>(
        `/establishments/${establishmentId}/professionals/${professionalId}/invite`,
        { email }
      )
      .then((r) => r.data),

  // publico: carrega dados do convite pela tela de aceite
  get: (token: string) =>
    api.get<InviteInfo>(`/invites/${token}`).then((r) => r.data),

  // publico: aceita (cria conta ou vincula) e devolve token de login
  accept: (token: string, data: { name?: string; password?: string }) =>
    api
      .post<AcceptInviteResult>(`/invites/${token}/accept`, data)
      .then((r) => r.data),
};