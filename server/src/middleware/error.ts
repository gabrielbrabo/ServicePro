import { Request, Response, NextFunction } from "express";

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ message: `Rota nao encontrada: ${req.originalUrl}` });
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(err);
  res.status(500).json({ message: err.message || "Erro interno do servidor" });
};
