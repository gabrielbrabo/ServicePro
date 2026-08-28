import { Schema, model, Document, Types } from "mongoose";

// Avaliacao de massagem de um CLIENTE (categoria massagem, area Beleza).
// Uma por (cliente + estabelecimento). Versao leve da avaliacao da fisio.

export interface IMassageAssessment extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  mainComplaint: string; // queixa principal
  tensionPoints: string; // pontos de tensao / regioes
  contraindications: string; // contraindicacoes
  goals: string; // objetivo
  observations: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const massageAssessmentSchema = new Schema<IMassageAssessment>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mainComplaint: { type: String, default: "", trim: true },
    tensionPoints: { type: String, default: "", trim: true },
    contraindications: { type: String, default: "", trim: true },
    goals: { type: String, default: "", trim: true },
    observations: { type: String, default: "", trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

massageAssessmentSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const MassageAssessment = model<IMassageAssessment>(
  "MassageAssessment",
  massageAssessmentSchema
);
