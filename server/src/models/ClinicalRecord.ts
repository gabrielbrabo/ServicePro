import { Schema, model, Document, Types } from "mongoose";

// Ficha clinica (extra saude: psicologia, fonoaudiologia, acupuntura,
// quiropraxia). Por PACIENTE: avaliacao/queixa + evolucoes por sessao no
// formato SOAP (Subjetivo, Objetivo, Avaliacao, Plano).

export interface IClinicalSession {
  date: string; // data da sessao (texto/data)
  subjective: string; // S: relato do paciente
  objective: string; // O: achados/observacao
  assessment: string; // A: avaliacao/hipotese
  plan: string; // P: conduta/plano
  cid: string; // CID-10 (codigo/descricao) desta evolucao
}

export interface IClinicalRecord extends Document {
  establishment: Types.ObjectId;
  patientName: string;
  patientPhone: string;
  complaint: string; // queixa principal
  history: string; // historico / avaliacao inicial (anamnese resumida)
  sessions: Types.DocumentArray<IClinicalSession & Document>;
  nextReturn: string; // retorno previsto (data/texto)
  notes: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<IClinicalSession>(
  {
    date: { type: String, default: "", trim: true },
    subjective: { type: String, default: "", trim: true },
    objective: { type: String, default: "", trim: true },
    assessment: { type: String, default: "", trim: true },
    plan: { type: String, default: "", trim: true },
    cid: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const clinicalRecordSchema = new Schema<IClinicalRecord>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    patientName: { type: String, default: "", trim: true },
    patientPhone: { type: String, default: "", trim: true },
    complaint: { type: String, default: "", trim: true },
    history: { type: String, default: "", trim: true },
    sessions: { type: [sessionSchema], default: [] },
    nextReturn: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

clinicalRecordSchema.index({ establishment: 1, updatedAt: -1 });

export const ClinicalRecord = model<IClinicalRecord>(
  "ClinicalRecord",
  clinicalRecordSchema
);
