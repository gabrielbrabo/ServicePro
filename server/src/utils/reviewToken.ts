import crypto from "crypto";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// Token curto e assinado (HMAC-SHA256) para AVALIAR EM 1 TOQUE, sem login.
// Vai no link enviado por e-mail/WhatsApp apos concluir o atendimento.
// Formato: base64url(bookingId.exp) + "." + assinatura(base64url)
// ---------------------------------------------------------------------------

const SECRET = env.jwtSecret;
const TTL_MS = 45 * 24 * 60 * 60 * 1000; // validade de 45 dias

const sign = (payload: string): string =>
  crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");

export function signReviewToken(bookingId: string): string {
  const payload = `${bookingId}.${Date.now() + TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

// devolve o bookingId se o token for valido e nao expirou; senao null.
export function verifyReviewToken(token: string): string | null {
  try {
    const [body, sig] = String(token).split(".");
    if (!body || !sig) return null;
    const payload = Buffer.from(body, "base64url").toString("utf8");
    const expected = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const [bookingId, expStr] = payload.split(".");
    const exp = Number(expStr);
    if (!bookingId || !exp || Date.now() > exp) return null;
    return bookingId;
  } catch {
    return null;
  }
}
