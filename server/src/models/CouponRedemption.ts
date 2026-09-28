import { Schema, model, Document, Types } from "mongoose";

// Uso de um cupom. Unico por (cupom, dono): o mesmo dono nao usa o mesmo cupom
// duas vezes (nem em outro estabelecimento).
export interface ICouponRedemption extends Document {
  coupon: Types.ObjectId;
  code: string;
  owner: Types.ObjectId;
  establishment: Types.ObjectId;
  type: "free" | "discount";
  createdAt: Date;
}

const schema = new Schema<ICouponRedemption>(
  {
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    code: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    type: { type: String, enum: ["free", "discount"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ coupon: 1, owner: 1 }, { unique: true });

export const CouponRedemption = model<ICouponRedemption>(
  "CouponRedemption",
  schema
);
