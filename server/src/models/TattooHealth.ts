import { Schema, model, Document, Types } from "mongoose";

// Declaracao de saude para tatuagem de um CLIENTE (categoria tatuagem).
// Uma por (cliente + estabelecimento). E o screening de seguranca/biosseguranca
// que o cliente declara antes do procedimento. Registro leve, nao substitui
// termo com assinatura fisica.

export interface ITattooHealth extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  conditions: string[]; // condicoes marcadas (slugs de uma lista fixa)
  allergies: string;
  medications: string;
  pregnant: boolean;
  other: string;
  signedName: string; // nome de quem declarou
  signedAt: Date | null; // data da declaracao (null = nao assinada)
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tattooHealthSchema = new Schema<ITattooHealth>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    conditions: { type: [String], default: [] },
    allergies: { type: String, default: "", trim: true },
    medications: { type: String, default: "", trim: true },
    pregnant: { type: Boolean, default: false },
    other: { type: String, default: "", trim: true },
    signedName: { type: String, default: "", trim: true },
    signedAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

tattooHealthSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const TattooHealth = model<ITattooHealth>(
  "TattooHealth",
  tattooHealthSchema
);
