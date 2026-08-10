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
  emailVerified?: boolean;
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
  }) => api.post<AuthResponse>("/auth/register", data).then((r) => r.data),

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

  google: (credential: string) =>
    api
      .post<{ token: string; user: User }>("/auth/google", { credential })
      .then((r) => r.data),
};