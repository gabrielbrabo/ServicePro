import { Schema, model, Document, Types } from "mongoose";

// Plano de tratamento / orcamento de um paciente num estabelecimento.
// Um paciente pode ter varios planos ao longo do tempo.
// Cada item e um procedimento com preco e status feito/pendente.

export interface ITreatmentItem {
  _id: Types.ObjectId;
  description: string;
  price: number;
  done: boolean;
  doneAt?: Date;
}

export interface ITreatmentPlan extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  title: string;
  items: Types.DocumentArray<ITreatmentItem>;
  discount: number; // desconto em R$ sobre o subtotal
  installments: number; // numero de parcelas (informativo)
  status: "aberto" | "concluido" | "cancelado";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ITreatmentItem>({
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0, default: 0 },
  done: { type: Boolean, default: false },
  doneAt: { type: Date },
});

const treatmentPlanSchema = new Schema<ITreatmentPlan>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "Plano de tratamento", trim: true },
    items: { type: [itemSchema], default: [] },
    discount: { type: Number, default: 0, min: 0 },
    installments: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["aberto", "concluido", "cancelado"],
      default: "aberto",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

treatmentPlanSchema.index({ establishment: 1, client: 1, createdAt: -1 });

export const TreatmentPlan = model<ITreatmentPlan>(
  "TreatmentPlan",
  treatmentPlanSchema
);