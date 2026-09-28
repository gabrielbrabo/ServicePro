import crypto from "crypto";
import { Types } from "mongoose";
import { Coupon, ICoupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { ISubscription } from "../models/Subscription";

export const normalizeCode = (v: unknown): string =>
  String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

// codigo aleatorio legivel (sem 0/O/1/I para nao confundir)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode(prefix = "SP"): string {
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}-${s.slice(0, 4)}-${s.slice(4)}`;
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

// texto curto do beneficio ("1 mês grátis", "20% de desconto nas 3 primeiras
// cobranças", ...)
export function describeCoupon(c: Pick<ICoupon, "type" | "freeMonths" | "percent" | "discountCharges" | "appliesTo">): string {
  const cycle =
    c.appliesTo === "mensal"
      ? " (plano mensal)"
      : c.appliesTo === "anual"
        ? " (plano anual)"
        : "";
  if (c.type === "free") {
    const m = c.freeMonths;
    return `${m} ${m === 1 ? "mês grátis" : "meses grátis"}${cycle}`;
  }
  const when =
    c.discountCharges === -1
      ? "em todas as cobranças"
      : c.discountCharges === 1
        ? "na 1ª cobrança"
        : `nas ${c.discountCharges} primeiras cobranças`;
  return `${c.percent}% de desconto ${when}${cycle}`;
}

// valor com desconto aplicado (nunca abaixo de R$ 5 — minimo do gateway)
export function applyPercent(cents: number, percent: number): number {
  const v = Math.round((cents * (100 - percent)) / 100);
  return Math.max(v, 500);
}

// quantas cobrancas o desconto vale NESTE ciclo. No anual, "N cobrancas"
// vira 1 anuidade (senao "3 cobrancas" seriam 3 anos); "para sempre" (-1) e
// "so a 1a" (1) ficam iguais.
export function discountChargesFor(
  couponCharges: number,
  cycle: "mensal" | "anual"
): number {
  if (couponCharges === -1) return -1;
  return cycle === "anual" ? 1 : couponCharges;
}

// desconto do cupom ainda valendo nesta assinatura?
export function discountActive(sub: Pick<ISubscription, "discountPercent" | "discountChargesLeft">): boolean {
  return (
    (sub.discountPercent || 0) > 0 &&
    (sub.discountChargesLeft === -1 || (sub.discountChargesLeft || 0) > 0)
  );
}

// preco do PLANO que efetivamente e cobrado (com desconto, se houver)
export function effectivePlanCents(
  sub: Pick<ISubscription, "discountPercent" | "discountChargesLeft">,
  planCents: number
): number {
  return discountActive(sub)
    ? applyPercent(planCents, sub.discountPercent)
    : planCents;
}

export type CouponCheck =
  | { ok: true; coupon: ICoupon }
  | { ok: false; message: string };

// valida um codigo para um dono/ciclo (nao consome)
export async function findUsableCoupon(
  codeRaw: unknown,
  opts: { ownerId?: string; cycle?: "mensal" | "anual" }
): Promise<CouponCheck> {
  const code = normalizeCode(codeRaw);
  if (!code) return { ok: false, message: "Informe o código do cupom." };
  const coupon = await Coupon.findOne({ code });
  if (!coupon || !coupon.active) {
    return { ok: false, message: "Cupom inválido ou desativado." };
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { ok: false, message: "Este cupom expirou." };
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, message: "Este cupom já atingiu o limite de usos." };
  }
  if (
    opts.cycle &&
    coupon.appliesTo !== "ambos" &&
    coupon.appliesTo !== opts.cycle
  ) {
    return {
      ok: false,
      message: `Este cupom vale só para o plano ${coupon.appliesTo}.`,
    };
  }
  if (opts.ownerId) {
    const used = await CouponRedemption.exists({
      coupon: coupon._id,
      owner: opts.ownerId,
    });
    if (used) return { ok: false, message: "Você já usou este cupom." };
  }
  return { ok: true, coupon };
}

// Consome 1 uso (atomico: respeita maxUses mesmo com acessos simultaneos) e
// registra quem usou. false = acabou o limite ou o dono ja tinha usado.
export async function consumeCoupon(
  coupon: ICoupon,
  ownerId: Types.ObjectId | string,
  establishmentId: Types.ObjectId | string
): Promise<boolean> {
  try {
    await CouponRedemption.create({
      coupon: coupon._id,
      code: coupon.code,
      owner: ownerId,
      establishment: establishmentId,
      type: coupon.type,
    });
  } catch {
    return false; // indice unico: dono ja usou
  }
  const filter: Record<string, unknown> = { _id: coupon._id, active: true };
  if (coupon.maxUses > 0) filter.usedCount = { $lt: coupon.maxUses };
  const upd = await Coupon.updateOne(filter, { $inc: { usedCount: 1 } });
  if (upd.modifiedCount === 0) {
    await CouponRedemption.deleteOne({ coupon: coupon._id, owner: ownerId });
    return false;
  }
  return true;
}

// devolve um uso consumido (ex.: a operacao depois do consumo falhou)
export async function releaseCoupon(
  coupon: ICoupon,
  ownerId: Types.ObjectId | string
): Promise<void> {
  await CouponRedemption.deleteOne({ coupon: coupon._id, owner: ownerId });
  await Coupon.updateOne(
    { _id: coupon._id, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } }
  );
}

export { brl as formatBrl };
