import { Schema, model, Document, Types } from "mongoose";

// Ficha do PACIENTE (acupuntura): dados que nao mudam a cada sessao — queixa
// principal, diagnostico MTC (padrao/sindrome), lingua e pulso, contraindicacoes
// e observacoes. Um documento por (establishment, client), upsert. Os pontos
// aplicados por sessao ficam em AcupunctureSession.

export interface IAcupunctureProfile extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  mainComplaint: string; // queixa principal
  tcmPattern: string; // diagnostico/padrao MTC (sindrome)
  tongue: string; // lingua
  pulse: string; // pulso
  contraindications: string; // gestante, marca-passo, etc.
  healthNotes: string; // observacoes gerais
  createdAt: Date;
  updatedAt: Date;
}

const acupunctureProfileSchema = new Schema<IAcupunctureProfile>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mainComplaint: { type: String, default: "", trim: true },
    tcmPattern: { type: String, default: "", trim: true },
    tongue: { type: String, default: "", trim: true },
    pulse: { type: String, default: "", trim: true },
    contraindications: { type: String, default: "", trim: true },
    healthNotes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

acupunctureProfileSchema.index(
  { establishment: 1, client: 1 },
  { unique: true }
);

export const AcupunctureProfile = model<IAcupunctureProfile>(
  "AcupunctureProfile",
  acupunctureProfileSchema
);
