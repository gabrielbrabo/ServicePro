import { Schema, model, Document, Types } from "mongoose";

// Convenio / operadora de plano de saude atendido por um estabelecimento.
// Base da Fase 1 (gestao de convenio) e da Fase 2 (guias TISS/XML).

export interface IHealthPlan extends Document {
  establishment: Types.ObjectId;
  name: string;
  ansRegistry?: string; // registro ANS da operadora (usado depois no TISS)
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const healthPlanSchema = new Schema<IHealthPlan>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    ansRegistry: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

healthPlanSchema.index({ establishment: 1, name: 1 });

export const HealthPlan = model<IHealthPlan>("HealthPlan", healthPlanSchema);
