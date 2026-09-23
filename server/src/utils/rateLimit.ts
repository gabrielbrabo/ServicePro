import { Request, Response, NextFunction, RequestHandler } from "express";

// Limitador de tentativas em memoria (janela fixa), sem dependencia externa.
// Suficiente para 1 instancia no Render. Se um dia escalar para varias
// instancias, trocar o Map por Redis (a interface continua a mesma).

interface Bucket {
  count: number;
  resetAt: number;
}

interface LimiterOptions {
  windowMs: number;
  max: number;
  // chave do balde; null = nao limita esta requisicao
  key: (req: Request) => string | null;
  message?: string;
}

// IP do cliente (depende de app.set("trust proxy", 1) atras do proxy do Render)
export const clientIp = (req: Request): string =>
  req.ip || req.socket.remoteAddress || "desconhecido";

// e-mail do corpo, normalizado (mesma regra do model: trim + minusculo)
export const bodyEmail = (req: Request): string =>
  typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";

export const createLimiter = (opts: LimiterOptions): RequestHandler => {
  const store = new Map<string, Bucket>();

  // limpeza periodica dos baldes vencidos (unref: nao segura o processo vivo)
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
  }, 60_000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = opts.key(req);
    if (!key) {
      next();
      return;
    }

    const now = Date.now();
    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > opts.max) {
      const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      const minutes = Math.ceil(retrySec / 60);
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).json({
        message:
          opts.message ||
          `Muitas tentativas. Tente novamente em ${minutes} minuto${
            minutes > 1 ? "s" : ""
          }.`,
      });
      return;
    }
    next();
  };
};
