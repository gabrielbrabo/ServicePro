import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/token";
import { User } from "../models/User";

// Estende o Request do Express para carregar o usuario autenticado
export interface AuthRequest extends Request {
  userId?: string;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ message: "Nao autenticado" });
      return;
    }

    const token = header.split(" ")[1];
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({ message: "Usuario nao encontrado" });
      return;
    }

    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: "Token invalido ou expirado" });
  }
};
