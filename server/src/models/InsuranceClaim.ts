import { Schema, model, Document, Types } from "mongoose";

// Guia de convenio: um atendimento faturado a um plano de saude, com uma ou
// mais linhas de procedimento (TUSS + qtd + valor + status). Formato inspirado
// na guia TISS — ja prepara a Fase 2 (geracao do XML).

export type ProcedureStatus = "pendente" | "pago" | "glosado";

export interface IClaimProcedure {
  tussCode: string;
  description?: string;
  quantity: number;
  unitValue: number;
  status: ProcedureStatus;
  glosaReason?: string;
}

export interface IInsuranceClaim extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  healthPlan: Types.ObjectId;
  cardNumber?: string;
  cardValidThru?: Date;
  professional?: Types.ObjectId; // subdoc profissional (opcional)
  booking?: Types.ObjectId; // agendamento de origem (opcional)
  guideNumber?: string; // numero da guia (prestador)
  date: Date; // data do atendimento
  procedures: IClaimProcedure[];
  notes?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const procedureSchema = new Schema<IClaimProcedure>(
  {
    tussCode: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    unitValue: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["pendente", "pago", "glosado"],
      default: "pendente",
    },
    glosaReason: { type: String, trim: true },
  },
  { _id: false }
);

const claimSchema = new Schema<IInsuranceClaim>(
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
    cardNumber: { type: String, trim: true },
    cardValidThru: { type: Date },
    professional: { type: Schema.Types.ObjectId },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    guideNumber: { type: String, trim: true },
    date: { type: Date, required: true, default: Date.now },
    procedures: { type: [procedureSchema], default: [] },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

claimSchema.index({ establishment: 1, createdAt: -1 });
claimSchema.index({ establishment: 1, client: 1, createdAt: -1 });
claimSchema.index({ establishment: 1, healthPlan: 1, createdAt: -1 });

export const InsuranceClaim = model<IInsuranceClaim>(
  "InsuranceClaim",
  claimSchema
);
