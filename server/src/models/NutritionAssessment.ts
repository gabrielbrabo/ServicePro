import { Schema, model, Document, Types } from "mongoose";

// Antropometria de um PACIENTE num ESTABELECIMENTO (nutrição). Várias por
// paciente (datadas), para acompanhar a evolução. Guarda peso, altura, % de
// gordura e circunferências (cm). IMC, RCQ (cintura/quadril), massa gorda e
// massa magra são calculados na hora (não são gravados).

export interface IBodyMeasurements {
  neck: number; // pescoço
  shoulder: number; // ombro
  chest: number; // peitoral / tórax
  waist: number; // cintura
  abdomen: number; // abdômen
  hip: number; // quadril
  armRelaxed: number; // braço relaxado
  armFlexed: number; // braço contraído
  forearm: number; // antebraço
  thigh: number; // coxa
  calf: number; // panturrilha
}

export interface INutritionAssessment extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem avaliou
  date: Date;
  weight: number; // kg (0 = não medido)
  height: number; // cm (0 = não medido)
  bodyFat: number; // % de gordura (0 = não medido)
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

const nutritionAssessmentSchema = new Schema<INutritionAssessment>(
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
    measurements: { type: measurementsSchema, default: () => ({}) },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

nutritionAssessmentSchema.index({ establishment: 1, client: 1, date: -1 });

export const NutritionAssessment = model<INutritionAssessment>(
  "NutritionAssessment",
  nutritionAssessmentSchema
);
