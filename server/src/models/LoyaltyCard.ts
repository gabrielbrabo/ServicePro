import { Schema, model, Document, Types } from "mongoose";

// Cartao de fidelidade de um CLIENTE num ESTABELECIMENTO. Um por
// (cliente + estabelecimento). `stamps` e o saldo atual rumo a proxima
// recompensa; `rewardsGiven` conta quantas recompensas ja foram resgatadas.
// `history` registra cada acao para consulta.

export type LoyaltyAction =
  | "carimbo"
  | "estorno"
  | "resgate"
  | "conquista"; // atingiu a meta -> recompensa pendente

export interface ILoyaltyEntry {
  _id: Types.ObjectId;
  action: LoyaltyAction;
  date: Date;
  by: Types.ObjectId;
}

export interface ILoyaltyCard extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  stamps: number;
  rewardsGiven: number;
  rewardsPending: number; // recompensas conquistadas ainda nao entregues
  history: Types.DocumentArray<ILoyaltyEntry>;
  createdAt: Date;
  updatedAt: Date;
}

const loyaltyEntrySchema = new Schema<ILoyaltyEntry>({
  action: {
    type: String,
    enum: ["carimbo", "estorno", "resgate", "conquista"],
    required: true,
  },
  date: { type: Date, default: Date.now },
  by: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

const loyaltyCardSchema = new Schema<ILoyaltyCard>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    stamps: { type: Number, default: 0, min: 0 },
    rewardsGiven: { type: Number, default: 0, min: 0 },
    rewardsPending: { type: Number, default: 0, min: 0 },
    history: { type: [loyaltyEntrySchema], default: [] },
  },
  { timestamps: true }
);

loyaltyCardSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const LoyaltyCard = model<ILoyaltyCard>(
  "LoyaltyCard",
  loyaltyCardSchema
);
