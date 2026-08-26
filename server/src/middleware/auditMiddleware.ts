import { Response, NextFunction } from "express";
import { AuditLog } from "../models/AuditLog";
import { AuthRequest } from "./auth";

const actionOf = (method: string): "view" | "create" | "update" | "delete" | "other" => {
  switch (method.toUpperCase()) {
    case "GET":
      return "view";
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return "other";
  }
};

// Middleware de auditoria LGPD. Aplique DEPOIS de protect (+ requireModule) nas
// rotas que tocam dados de paciente. Registra so acessos bem-sucedidos, sem
// bloquear a resposta (grava no evento "finish"). Falha silenciosa.
export const audit = (resource: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    res.on("finish", () => {
      if (res.statusCode >= 400 || !req.userId) return;
      const establishment = req.params.establishmentId;
      if (!establishment) return;
      const client = req.params.clientId;
      AuditLog.create({
        establishment,
        client: client || undefined,
        actor: req.userId,
        action: actionOf(req.method),
        resource,
        method: req.method,
        path: (req.originalUrl || "").split("?")[0],
        status: res.statusCode,
        ip: req.ip,
      }).catch((e) => console.error("audit:", e));
    });
    next();
  };
};
