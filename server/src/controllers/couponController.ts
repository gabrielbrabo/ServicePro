import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Coupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { Establishment } from "../models/Establishment";
import { getPlan, priceForCycle } from "../config/plans";
import {
  findUsableCoupon,
  describeCoupon,
  applyPercent,
  normalizeCode,
  randomCode,
} from "../utils/coupons";

// POST /api/coupons/check  (logado)  body: { code, planId, billingCycle }
// Confere o cupom ANTES de usar (mostra o beneficio e o preco com desconto).
export const checkCoupon = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { code, planId, billingCycle } = req.body as {
      code?: string;
      planId?: string;
      billingCycle?: "mensal" | "anual";
    };
    const cycle = billingCycle === "anual" ? "anual" : "mensal";
    const check = await findUsableCoupon(code, {
      ownerId: String(req.userId),
      cycle,
    });
    if (!check.ok) {
      res.status(400).json({ message: check.message });
      return;
    }
    const c = check.coupon;
    const plan = getPlan(planId);
    const fullCents = plan ? priceForCycle(plan, cycle) : 0;
    res.json({
      code: c.code,
      type: c.type,
      label: describeCoupon(c),
      freeMonths: c.freeMonths,
      percent: c.percent,
      discountCharges: c.discountCharges,
      appliesTo: c.appliesTo,
      fullCents,
      discountedCents:
        c.type === "discount" && fullCents
          ? applyPercent(fullCents, c.percent)
          : fullCents,
    });
  } catch (err) {
    console.error("checkCoupon:", err);
    res.status(500).json({ message: "Erro ao verificar o cupom" });
  }
};

// ---- ADMIN (so ADMIN_EMAILS) ----

// GET /api/admin/coupons
export const adminListCoupons = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json({
      coupons: coupons.map((c) => ({ ...c, label: describeCoupon(c) })),
    });
  } catch (err) {
    console.error("adminListCoupons:", err);
    res.status(500).json({ message: "Erro ao listar cupons" });
  }
};

// POST /api/admin/coupons
// body: { type, freeMonths?, percent?, discountCharges?, appliesTo?, maxUses?,
//         expiresAt?, note?, code?, quantity? }
// code: codigo proprio (ex.: "LANCAMENTO"). Sem code: gera aleatorios.
// quantity: gera N codigos diferentes (cada um com o mesmo beneficio).
export const adminCreateCoupons = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const b = (req.body || {}) as Record<string, unknown>;
    const type = b.type === "discount" ? "discount" : b.type === "free" ? "free" : null;
    if (!type) {
      res.status(400).json({ message: "Escolha o tipo: mensalidade grátis ou desconto." });
      return;
    }
    const freeMonths = Math.floor(Number(b.freeMonths) || 0);
    const percent = Math.floor(Number(b.percent) || 0);
    let discountCharges = Math.floor(Number(b.discountCharges) || 1);
    if (type === "free" && (freeMonths < 1 || freeMonths > 24)) {
      res.status(400).json({ message: "Meses grátis: de 1 a 24." });
      return;
    }
    if (type === "discount") {
      if (percent < 1 || percent > 90) {
        res.status(400).json({ message: "Desconto: de 1% a 90%." });
        return;
      }
      if (discountCharges !== -1 && (discountCharges < 1 || discountCharges > 60)) {
        res.status(400).json({ message: "Cobranças com desconto: de 1 a 60, ou para sempre." });
        return;
      }
    } else {
      discountCharges = 1;
    }
    const appliesTo =
      b.appliesTo === "mensal" || b.appliesTo === "anual" ? b.appliesTo : "ambos";
    const maxUses = Math.max(0, Math.floor(Number(b.maxUses) || 0));
    const expiresAt = b.expiresAt ? new Date(String(b.expiresAt)) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) {
      res.status(400).json({ message: "Data de validade inválida." });
      return;
    }
    if (expiresAt) expiresAt.setHours(23, 59, 59, 999);
    const note = String(b.note || "").slice(0, 200);
    const customCode = normalizeCode(b.code);
    const quantity = customCode
      ? 1
      : Math.min(100, Math.max(1, Math.floor(Number(b.quantity) || 1)));

    if (customCode && !/^[A-Z0-9-]{3,30}$/.test(customCode)) {
      res.status(400).json({
        message: "Código: 3 a 30 caracteres (letras, números e hífen).",
      });
      return;
    }
    if (customCode && (await Coupon.exists({ code: customCode }))) {
      res.status(409).json({ message: "Já existe um cupom com esse código." });
      return;
    }

    const base = {
      type,
      freeMonths: type === "free" ? freeMonths : 0,
      percent: type === "discount" ? percent : 0,
      discountCharges,
      appliesTo,
      maxUses,
      expiresAt,
      note,
      active: true,
      createdBy: req.userId,
    };
    const created = [];
    for (let i = 0; i < quantity; i++) {
      let code = customCode;
      for (let tries = 0; !code && tries < 6; tries++) {
        const c = randomCode(type === "free" ? "GRATIS" : "DESC");
        if (!(await Coupon.exists({ code: c }))) code = c;
      }
      if (!code) continue;
      created.push(await Coupon.create({ ...base, code }));
    }
    res.status(201).json({
      coupons: created.map((c) => ({ ...c.toObject(), label: describeCoupon(c) })),
    });
  } catch (err) {
    console.error("adminCreateCoupons:", err);
    res.status(500).json({ message: "Erro ao gerar cupons" });
  }
};

// PATCH /api/admin/coupons/:id  body: { active }
export const adminUpdateCoupon = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const c = await Coupon.findById(req.params.id);
    if (!c) {
      res.status(404).json({ message: "Cupom nao encontrado" });
      return;
    }
    if (typeof req.body?.active === "boolean") c.active = req.body.active;
    await c.save();
    res.json({ coupon: { ...c.toObject(), label: describeCoupon(c) } });
  } catch (err) {
    console.error("adminUpdateCoupon:", err);
    res.status(500).json({ message: "Erro ao atualizar o cupom" });
  }
};

// GET /api/admin/coupons/:id/redemptions — quem usou
export const adminCouponRedemptions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const list = await CouponRedemption.find({ coupon: req.params.id })
      .sort({ createdAt: -1 })
      .populate("owner", "name email")
      .lean();
    const estIds = list.map((r) => r.establishment);
    const ests = await Establishment.find({ _id: { $in: estIds } })
      .select("name")
      .lean();
    const names = new Map(ests.map((e) => [String(e._id), e.name]));
    res.json({
      redemptions: list.map((r) => {
        const o = r.owner as unknown as { name?: string; email?: string } | null;
        return {
          at: r.createdAt,
          ownerName: o?.name || "",
          ownerEmail: o?.email || "",
          establishmentName: names.get(String(r.establishment)) || "",
        };
      }),
    });
  } catch (err) {
    console.error("adminCouponRedemptions:", err);
    res.status(500).json({ message: "Erro ao listar usos" });
  }
};
