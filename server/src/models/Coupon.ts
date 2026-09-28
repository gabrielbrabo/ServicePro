import { Schema, model, Document, Types } from "mongoose";

// Cupom do ServiçosPro para a assinatura dos estabelecimentos. Gerado so pelo
// admin (/admin). Dois tipos:
//  - "free":     meses gratis (usa o sistema sem pagar; depois assina)
//  - "discount": % de desconto na mensalidade/anuidade por N cobrancas
//                (ou para sempre)
export type CouponType = "free" | "discount";
export type CouponCycle = "ambos" | "mensal" | "anual";

export interface ICoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  type: CouponType;
  freeMonths: number; // type free
  percent: number; // type discount (1-90)
  // type discount: quantas cobrancas com desconto (1 = so a 1a; -1 = sempre)
  discountCharges: number;
  appliesTo: CouponCycle; // ciclo em que o cupom vale
  maxUses: number; // 0 = ilimitado
  usedCount: number;
  expiresAt: Date | null;
  active: boolean;
  note: string;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: { type: String, enum: ["free", "discount"], required: true },
    freeMonths: { type: Number, default: 0, min: 0, max: 24 },
    percent: { type: Number, default: 0, min: 0, max: 90 },
    discountCharges: { type: Number, default: 1 },
    appliesTo: {
      type: String,
      enum: ["ambos", "mensal", "anual"],
      default: "ambos",
    },
    maxUses: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    note: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Coupon = model<ICoupon>("Coupon", couponSchema);
