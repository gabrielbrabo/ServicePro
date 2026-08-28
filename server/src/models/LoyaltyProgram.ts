import { Schema, model, Document, Types } from "mongoose";

// Configuracao do programa de fidelidade de um ESTABELECIMENTO (area Beleza).
// Um por estabelecimento. Define a meta de carimbos e a recompensa.

export interface ILoyaltyProgram extends Document {
  establishment: Types.ObjectId;
  goal: number; // quantos carimbos para ganhar a recompensa
  reward: string; // descricao da recompensa (ex.: "1 corte gratis")
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const loyaltyProgramSchema = new Schema<ILoyaltyProgram>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
      unique: true,
    },
    goal: { type: Number, default: 10, min: 1 },
    reward: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LoyaltyProgram = model<ILoyaltyProgram>(
  "LoyaltyProgram",
  loyaltyProgramSchema
);
