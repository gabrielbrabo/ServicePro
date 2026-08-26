import { Schema, model, Document, Types } from "mongoose";

// Carteirinha do paciente num convenio. Um registro por (estabelecimento,
// paciente, convenio) — reaproveitado ao lancar novas guias.

export interface IInsuranceCard extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  healthPlan: Types.ObjectId;
  number: string; // numero da carteirinha
  validThru?: Date; // validade
  holderName?: string; // titular (se diferente do paciente)
  createdAt: Date;
  updatedAt: Date;
}

const cardSchema = new Schema<IInsuranceCard>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    healthPlan: {
      type: Schema.Types.ObjectId,
      ref: "HealthPlan",
      required: true,
    },
    number: { type: String, required: true, trim: true },
    validThru: { type: Date },
    holderName: { type: String, trim: true },
  },
  { timestamps: true }
);

cardSchema.index(
  { establishment: 1, client: 1, healthPlan: 1 },
  { unique: true }
);

export const InsuranceCard = model<IInsuranceCard>(
  "InsuranceCard",
  cardSchema
);
