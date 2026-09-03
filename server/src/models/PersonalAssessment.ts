import { Schema, model, Document, Types } from "mongoose";

// Avaliacao fisica de um ALUNO num ESTABELECIMENTO (personal trainer). Varias
// por aluno (datadas), para comparar a evolucao ao longo do tempo. Guarda peso,
// altura, % de gordura, FC de repouso e as circunferencias (cm). O IMC e
// calculado na hora (peso / altura^2), nao e gravado.

export interface IBodyMeasurements {
  neck: number; // pescoco
  shoulder: number; // ombro
  chest: number; // peitoral / torax
  waist: number; // cintura
  abdomen: number; // abdomen
  hip: number; // quadril
  armRelaxed: number; // braco relaxado
  armFlexed: number; // braco contraido
  forearm: number; // antebraco
  thigh: number; // coxa
  calf: number; // panturrilha
}

export interface IPersonalAssessment extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // aluno
  author: Types.ObjectId; // quem avaliou
  date: Date;
  weight: number; // kg (0 = nao medido)
  height: number; // cm (0 = nao medido)
  bodyFat: number; // % de gordura (0 = nao medido)
  restingHr: number; // FC de repouso (bpm; 0 = nao medido)
  measurements: IBodyMeasurements;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const measurementsSchema = new Schema<IBodyMeasurements>(
  {
    neck: { type: Number, default: 0, min: 0 },
    shoulder: { type: Number, default: 0, min: 0 },
    chest: { type: Number, default: 0, min: 0 },
    waist: { type: Number, default: 0, min: 0 },
    abdomen: { type: Number, default: 0, min: 0 },
    hip: { type: Number, default: 0, min: 0 },
    armRelaxed: { type: Number, default: 0, min: 0 },
    armFlexed: { type: Number, default: 0, min: 0 },
    forearm: { type: Number, default: 0, min: 0 },
    thigh: { type: Number, default: 0, min: 0 },
    calf: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const personalAssessmentSchema = new Schema<IPersonalAssessment>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    weight: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    bodyFat: { type: Number, default: 0, min: 0 },
    restingHr: { type: Number, default: 0, min: 0 },
    measurements: { type: measurementsSchema, default: () => ({}) },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

personalAssessmentSchema.index({ establishment: 1, client: 1, date: -1 });

export const PersonalAssessment = model<IPersonalAssessment>(
  "PersonalAssessment",
  personalAssessmentSchema
);
