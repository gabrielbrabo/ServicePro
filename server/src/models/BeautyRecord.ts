import { Schema, model, Document, Types } from "mongoose";

// Ficha tecnica de um CLIENTE dentro de um ESTABELECIMENTO de beleza.
// Equivalente ao prontuario da saude, com campos proprios da beleza.
// Um por (cliente + estabelecimento). So dono/equipe acessam.

export interface IBeautyRecord extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  hairType: string; // tipo/textura de cabelo (liso, ondulado, cacheado, crespo...)
  scalpSkin: string; // couro cabeludo / tipo de pele
  allergies: string; // alergias (alerta de seguranca)
  sensitivities: string; // sensibilidades e reacoes anteriores a quimica
  chemicalHistory: string; // historico quimico (alisamento, coloracao, descoloracao)
  observations: string; // observacoes gerais
  createdAt: Date;
  updatedAt: Date;
}

const beautyRecordSchema = new Schema<IBeautyRecord>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    hairType: { type: String, default: "" },
    scalpSkin: { type: String, default: "" },
    allergies: { type: String, default: "" },
    sensitivities: { type: String, default: "" },
    chemicalHistory: { type: String, default: "" },
    observations: { type: String, default: "" },
  },
  { timestamps: true }
);

// uma ficha por cliente+estabelecimento
beautyRecordSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const BeautyRecord = model<IBeautyRecord>(
  "BeautyRecord",
  beautyRecordSchema
);
