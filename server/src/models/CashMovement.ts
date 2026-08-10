import { Schema, model, Document, Types } from "mongoose";

export type MovementType = "entrada" | "saida" | "sangria" | "suprimento";
export type PaymentMethod = "dinheiro" | "cartao" | "pix" | "outro";

export interface ICashMovement extends Document {
  session: Types.ObjectId;
  establishment: Types.ObjectId;
  createdBy: Types.ObjectId;
  type: MovementType;
  method: PaymentMethod;
  amount: number;
  description: string;
  booking: Types.ObjectId | null;
  professional: Types.ObjectId | null; // preenchido quando a entrada vem de servico
  createdAt: Date;
  updatedAt: Date;
}

const cashMovementSchema = new Schema<ICashMovement>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: "CashSession",
      required: true,
    },
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["entrada", "saida", "sangria", "suprimento"],
      required: true,
    },
    method: {
      type: String,
      enum: ["dinheiro", "cartao", "pix", "outro"],
      default: "dinheiro",
    },
    amount: { type: Number, required: true, min: 0.01 },
    description: { type: String, default: "" },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    // id do profissional (subdoc em Establishment.professionals); so em entradas de servico
    professional: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

cashMovementSchema.index({ session: 1, createdAt: 1 });
cashMovementSchema.index({ establishment: 1, createdAt: -1 });
// evita lancar o mesmo booking duas vezes
cashMovementSchema.index(
  { booking: 1 },
  { unique: true, partialFilterExpression: { booking: { $type: "objectId" } } }
);

export const CashMovement = model<ICashMovement>(
  "CashMovement",
  cashMovementSchema
);