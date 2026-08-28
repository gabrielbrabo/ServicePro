import { Schema, model, Document, Types } from "mongoose";

// Avaliacao estetica de um CLIENTE (categoria estetica, area Beleza).
// Uma por (cliente + estabelecimento). Guarda fototipo Fitzpatrick e a
// avaliacao clinica de pele. `fitzpatrick`: 0 = nao avaliado, 1..6 = escala.

export interface IAestheticAssessment extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  fitzpatrick: number; // 0 (nao avaliado) ou 1..6
  skinType: string; // oleosa, seca, mista, sensivel...
  mainComplaint: string; // queixa principal
  goals: string; // objetivo do tratamento
  contraindications: string; // contraindicacoes (gestante, isotretinoina...)
  observations: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const aestheticAssessmentSchema = new Schema<IAestheticAssessment>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fitzpatrick: { type: Number, default: 0, min: 0, max: 6 },
    skinType: { type: String, default: "", trim: true },
    mainComplaint: { type: String, default: "", trim: true },
    goals: { type: String, default: "", trim: true },
    contraindications: { type: String, default: "", trim: true },
    observations: { type: String, default: "", trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

aestheticAssessmentSchema.index(
  { establishment: 1, client: 1 },
  { unique: true }
);

export const AestheticAssessment = model<IAestheticAssessment>(
  "AestheticAssessment",
  aestheticAssessmentSchema
);
