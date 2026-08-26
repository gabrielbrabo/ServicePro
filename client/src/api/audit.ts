import { api } from "../lib/api";

export interface AuditActor {
  _id: string;
  name: string;
  email?: string;
}

export interface AuditClient {
  _id: string;
  name: string;
}

export interface AuditEntry {
  _id: string;
  action: "view" | "create" | "update" | "delete" | "other";
  resource: string;
  actor?: AuditActor | null;
  client?: AuditClient | null;
  method?: string;
  ip?: string;
  createdAt: string;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuditFilters {
  client?: string;
  resource?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

const base = "/audit";

export const auditApi = {
  list: (establishmentId: string, params?: AuditFilters) =>
    api
      .get<AuditPage>(`${base}/${establishmentId}`, { params })
      .then((r) => r.data),
};
