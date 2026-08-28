import { Schema, model, Document, Types } from "mongoose";

// Registro de aplicacao/procedimento estetico numa REGIAO do rosto ou corpo
// de um cliente. E o "mapa de aplicacao": cada documento e uma aplicacao numa
// regiao, com produto/quantidade/data. A listagem por cliente permite montar
// o historico por regiao.

export type AestheticArea = "face" | "corpo";

export interface IAestheticApplication extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  area: AestheticArea;
  region: string; // slug da regiao (ex.: "glabela", "abdomen")
  procedure: string; // procedimento (ex.: toxina, preenchimento, drenagem)
  product: string; // produto usado
  amount: string; // quantidade (ex.: "20 UI", "2 ml") — texto livre
  date: Date;
  note: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const aestheticApplicationSchema = new Schema<IAestheticApplication>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    area: { type: String, enum: ["face", "corpo"], default: "face" },
    region: { type: String, required: true, trim: true },
    procedure: { type: String, default: "", trim: true },
    product: { type: String, default: "", trim: true },
    amount: { type: String, default: "", trim: true },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

aestheticApplicationSchema.index({
  establishment: 1,
  client: 1,
  date: -1,
});

export const AestheticApplication = model<IAestheticApplication>(
  "AestheticApplication",
  aestheticApplicationSchema
);
