import { Schema, model, Document, Types } from "mongoose";

// Avaliacao fisioterapeutica de um PACIENTE num ESTABELECIMENTO. Varias por
// paciente (avaliacao inicial, reavaliacoes). Guarda a escala de dor EVA
// (0-10), amplitude de movimento (ADM/goniometria em texto), forca muscular,
// queixa, objetivos e observacoes. Dado sensivel: so dono/equipe.

export interface IPhysioAssessment extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem avaliou
  date: Date;
  mainComplaint: string; // queixa principal
  painEva: number | null; // escala visual analogica de dor (0-10); null = nao avaliado
  rangeOfMotion: string; // ADM / goniometria (texto)
  muscleStrength: string; // forca muscular (ex.: grau 0-5 por grupo)
  observations: string; // inspecao, palpacao, testes especiais, postura
  goals: string; // objetivos do tratamento
  createdAt: Date;
  updatedAt: Date;
}

const physioAssessmentSchema = new Schema<IPhysioAssessment>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    mainComplaint: { type: String, default: "", trim: true },
    painEva: { type: Number, min: 0, max: 10, default: null },
    rangeOfMotion: { type: String, default: "", trim: true },
    muscleStrength: { type: String, default: "", trim: true },
    observations: { type: String, default: "", trim: true },
    goals: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

physioAssessmentSchema.index({ establishment: 1, client: 1, date: -1 });

export const PhysioAssessment = model<IPhysioAssessment>(
  "PhysioAssessment",
  physioAssessmentSchema
);
