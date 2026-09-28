import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { User } from "../models/User";
import { isAdminEmail } from "../config/admin";

// So deixa passar usuarios cujo e-mail esta em ADMIN_EMAILS. Usar DEPOIS do
// protect. Responde 404 (nao 403) para nao revelar que a rota existe.
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findById(req.userId).select("email");
    if (!user || !isAdminEmail(user.email)) {
      res.status(404).json({ message: "Nao encontrado" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ message: "Erro ao validar acesso" });
  }
}
