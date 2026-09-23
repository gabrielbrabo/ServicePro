import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const signToken = (userId: string): string => {
  return jwt.sign({ id: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
};

// iat = momento de emissao (segundos), usado para invalidar sessoes antigas
export const verifyToken = (token: string): { id: string; iat?: number } => {
  return jwt.verify(token, env.jwtSecret) as { id: string; iat?: number };
};

// true se o token foi emitido antes da ultima troca de senha (sessao antiga).
// Compara em segundos: o token novo emitido no mesmo segundo da troca vale.
export const issuedBeforePasswordChange = (
  iat: number | undefined,
  passwordChangedAt: Date | undefined | null
): boolean => {
  if (!iat || !passwordChangedAt) return false;
  return Math.floor(passwordChangedAt.getTime() / 1000) > iat;
};
