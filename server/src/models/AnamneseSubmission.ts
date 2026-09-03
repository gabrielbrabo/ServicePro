import { Schema, model, Document, Types } from "mongoose";

// Anamnese preenchida pelo PACIENTE por link publico (antes da consulta).
// E do estabelecimento: cada documento e uma submissao com nome + respostas.

export interface IAnamneseAnswer {
  question: string;
  answer: string;
}
export interface IAnamneseSubmission extends Document {
  establishment: Types.ObjectId;
  patientName: string;
  patientPhone: string;
  answers: Types.DocumentArray<IAnamneseAnswer & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<IAnamneseAnswer>(
  {
    question: { type: String, default: "", trim: true },
    answer: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const submissionSchema = new Schema<IAnamneseSubmission>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
      index: true,
    },
    patientName: { type: String, default: "", trim: true },
    patientPhone: { type: String, default: "", trim: true },
    answers: { type: [answerSchema], default: [] },
  },
  { timestamps: true }
);

export const AnamneseSubmission = model<IAnamneseSubmission>(
  "AnamneseSubmission",
  submissionSchema
);
