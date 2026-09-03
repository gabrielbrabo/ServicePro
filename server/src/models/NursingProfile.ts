import { Schema, model, Document, Types } from "mongoose";

// Ficha do PACIENTE (enfermagem): dados que nao mudam a cada atendimento —
// alergias, comorbidades, medicacoes de uso continuo e observacoes. Um
// documento por (establishment, client), criado sob demanda (upsert). Os
// registros datados (sinais vitais, curativos, medicacao) ficam em NursingRecord.

export interface INursingProfile extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  allergies: string; // alergias (medicamentos, latex, etc.)
  conditions: string; // comorbidades / condicoes relevantes
  continuousMeds: string; // medicacoes de uso continuo
  bloodType: string; // tipo sanguineo (opcional)
  healthNotes: string; // observacoes gerais
  createdAt: Date;
  updatedAt: Date;
}

const nursingProfileSchema = new Schema<INursingProfile>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    allergies: { type: String, default: "", trim: true },
    conditions: { type: String, default: "", trim: true },
    continuousMeds: { type: String, default: "", trim: true },
    bloodType: { type: String, default: "", trim: true },
    healthNotes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

nursingProfileSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const NursingProfile = model<INursingProfile>(
  "NursingProfile",
  nursingProfileSchema
);
