import { api } from "../lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  country?: string;
  state?: string;
  city?: string;
  // registro profissional (usado para preencher documentos clinicos)
  councilType?: string;
  councilState?: string;
  councilNumber?: string;
  whatsappOptIn?: boolean;
  emailVerified?: boolean;
  // "google" = conta criada com Google, sem senha propria
  authProvider?: "local" | "google";
  // true = precisa aceitar a versao vigente dos Termos/Politica (TermsGate)
  mustAcceptTerms?: boolean;
  hasEstablishments?: boolean;
}

interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    country?: string;
    state?: string;
    city?: string;
    // indicacao: codigo do afiliado/representante que trouxe o usuario
    ref?: string;
    // aceite dos Termos de Uso + Politica de Privacidade (obrigatorio)
    acceptTerms: boolean;
  }) => api.post<AuthResponse>("/auth/register", data).then((r) => r.data),

  // aceite dos Termos/Politica vigentes (contas antigas, Google, nova versao)
  acceptTerms: () =>
    api
      .post<{ user: User }>("/auth/accept-terms", { accept: true })
      .then((r) => r.data.user),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", data).then((r) => r.data),

  me: () => api.get<{ user: User }>("/auth/me").then((r) => r.data.user),

  updateMe: (data: {
    name?: string;
    phone?: string;
    avatar?: string;
    country?: string;
    state?: string;
    city?: string;
    councilType?: string;
    councilState?: string;
    councilNumber?: string;
    whatsappOptIn?: boolean;
  }) =>
    api.patch<{ user: User }>("/auth/me", data).then((r) => r.data.user),

  verifyEmail: (token: string) =>
    api
      .post<{ message: string; alreadyDone?: boolean }>(
        `/auth/verify-email/${token}`
      )
      .then((r) => r.data),

  resendVerification: () =>
    api
      .post<{ message: string }>("/auth/resend-verification")
      .then((r) => r.data),

  // ref: indicacao de afiliado/representante (aplicada so em conta nova)
  google: (credential: string, ref?: string) =>
    api
      .post<{ token: string; user: User }>("/auth/google", { credential, ref })
      .then((r) => r.data),

  // --- recuperacao / troca de senha ---

  // resposta sempre generica (nao revela se o e-mail tem conta)
  // area "affiliate": o link do e-mail volta para o login do afiliado
  forgotPassword: (email: string, area: "app" | "affiliate" = "app") =>
    api
      .post<{ message: string }>("/auth/forgot-password", { email, area })
      .then((r) => r.data),

  // confere se o link ainda vale antes de mostrar o formulario
  validateResetToken: (token: string) =>
    api
      .get<{ valid: boolean; email: string }>(
        `/auth/reset-password/${encodeURIComponent(token)}`
      )
      .then((r) => r.data),

  resetPassword: (token: string, password: string) =>
    api
      .post<{ message: string }>("/auth/reset-password", { token, password })
      .then((r) => r.data),

  // devolve um token novo (o atual deixa de valer apos a troca)
  changePassword: (currentPassword: string, newPassword: string) =>
    api
      .post<{ message: string; token: string }>("/auth/change-password", {
        currentPassword,
        newPassword,
      })
      .then((r) => r.data),
};
