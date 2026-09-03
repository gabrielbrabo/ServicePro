import { Schema, model, Document, Types } from "mongoose";

// Ficha do ALUNO (personal trainer): dados que nao mudam a cada avaliacao —
// objetivo, anamnese/PAR-Q, restricoes e fotos de progresso. Um documento por
// (establishment, client), criado sob demanda (upsert).

export interface IProgressPhoto {
  url: string;
  date: Date;
  note: string;
}

export interface IPersonalProfile extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // aluno
  goal: string; // objetivo / meta
  // PAR-Q: 7 perguntas padrao (respostas sim/nao); parqNotes detalha os "sim"
  parq: boolean[]; // length 7 (true = "sim")
  parqNotes: string;
  restrictions: string; // lesoes, limitacoes, restricoes de exercicio
  healthNotes: string; // historico, medicamentos, observacoes gerais
  photos: Types.DocumentArray<IProgressPhoto & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const photoSchema = new Schema<IProgressPhoto>(
  {
    url: { type: String, default: "", trim: true },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const personalProfileSchema = new Schema<IPersonalProfile>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    goal: { type: String, default: "", trim: true },
    parq: { type: [Boolean], default: () => Array(7).fill(false) },
    parqNotes: { type: String, default: "", trim: true },
    restrictions: { type: String, default: "", trim: true },
    healthNotes: { type: String, default: "", trim: true },
    photos: { type: [photoSchema], default: [] },
  },
  { timestamps: true }
);

personalProfileSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const PersonalProfile = model<IPersonalProfile>(
  "PersonalProfile",
  personalProfileSchema
);
