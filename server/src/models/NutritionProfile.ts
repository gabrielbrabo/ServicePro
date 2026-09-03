import { Schema, model, Document, Types } from "mongoose";

// Ficha do PACIENTE (nutrição): dados e METAS que não mudam a cada avaliação —
// objetivo, nível de atividade, metas (peso, calorias, macros, água),
// restrições/alergias, preferências e fotos de progresso. Um documento por
// (establishment, client), criado sob demanda (upsert). As antropometrias
// (peso/medidas datadas) ficam em NutritionAssessment.

export interface IProgressPhoto {
  url: string;
  date: Date;
  note: string;
}

export interface INutritionProfile extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  goal: string; // objetivo (emagrecimento, hipertrofia, saúde...)
  activityLevel: string; // "" | sedentario | leve | moderado | intenso | atleta
  targetWeight: number; // meta de peso (kg; 0 = sem meta)
  targetCalories: number; // meta calórica (kcal/dia; 0 = sem meta)
  targetProtein: number; // meta de proteína (g/dia)
  targetCarbs: number; // meta de carboidrato (g/dia)
  targetFat: number; // meta de gordura (g/dia)
  targetWater: number; // meta de água (ml/dia)
  restrictions: string; // alergias, intolerâncias, restrições alimentares
  preferences: string; // preferências / aversões alimentares
  healthNotes: string; // histórico, medicamentos, condições relatadas
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

const nutritionProfileSchema = new Schema<INutritionProfile>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    goal: { type: String, default: "", trim: true },
    activityLevel: { type: String, default: "", trim: true },
    targetWeight: { type: Number, default: 0, min: 0 },
    targetCalories: { type: Number, default: 0, min: 0 },
    targetProtein: { type: Number, default: 0, min: 0 },
    targetCarbs: { type: Number, default: 0, min: 0 },
    targetFat: { type: Number, default: 0, min: 0 },
    targetWater: { type: Number, default: 0, min: 0 },
    restrictions: { type: String, default: "", trim: true },
    preferences: { type: String, default: "", trim: true },
    healthNotes: { type: String, default: "", trim: true },
    photos: { type: [photoSchema], default: [] },
  },
  { timestamps: true }
);

nutritionProfileSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const NutritionProfile = model<INutritionProfile>(
  "NutritionProfile",
  nutritionProfileSchema
);
