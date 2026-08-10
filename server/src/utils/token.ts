import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const signToken = (userId: string): string => {
  return jwt.sign({ id: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): { id: string } => {
  return jwt.verify(token, env.jwtSecret) as { id: string };
};
