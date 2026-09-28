import { api } from "../lib/api";

export type CouponType = "free" | "discount";
export type CouponCycle = "ambos" | "mensal" | "anual";

// resultado da conferencia de um cupom (antes de usar)
export interface CouponCheck {
  code: string;
  type: CouponType;
  label: string;
  freeMonths: number;
  percent: number;
  discountCharges: number; // -1 = para sempre
  appliesTo: CouponCycle;
  fullCents: number;
  discountedCents: number;
}

export interface AdminCoupon {
  _id: string;
  code: string;
  type: CouponType;
  label: string;
  freeMonths: number;
  percent: number;
  discountCharges: number;
  appliesTo: CouponCycle;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  note: string;
  createdAt: string;
}

export interface NewCouponPayload {
  type: CouponType;
  freeMonths?: number;
  percent?: number;
  discountCharges?: number;
  appliesTo?: CouponCycle;
  maxUses?: number;
  expiresAt?: string;
  note?: string;
  code?: string;
  quantity?: number;
}

export const couponApi = {
  check: (code: string, planId: string, billingCycle: "mensal" | "anual") =>
    api
      .post<CouponCheck>("/coupons/check", { code, planId, billingCycle })
      .then((r) => r.data),

  // ---- admin ----
  adminList: () =>
    api
      .get<{ coupons: AdminCoupon[] }>("/admin/coupons")
      .then((r) => r.data.coupons),
  adminCreate: (data: NewCouponPayload) =>
    api
      .post<{ coupons: AdminCoupon[] }>("/admin/coupons", data)
      .then((r) => r.data.coupons),
  adminSetActive: (id: string, active: boolean) =>
    api
      .patch<{ coupon: AdminCoupon }>(`/admin/coupons/${id}`, { active })
      .then((r) => r.data.coupon),
  adminRedemptions: (id: string) =>
    api
      .get<{
        redemptions: {
          at: string;
          ownerName: string;
          ownerEmail: string;
          establishmentName: string;
        }[];
      }>(`/admin/coupons/${id}/redemptions`)
      .then((r) => r.data.redemptions),
};
