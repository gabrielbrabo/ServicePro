import { Schema, model, Document, Types } from "mongoose";

// Configuracao de comissao por estabelecimento: a % de comissao de cada
// servico. Um documento por estabelecimento. Servico sem taxa cadastrada = 0%.
// A comissao incide sobre o valor recebido (payment.amount) de agendamentos
// concluidos e pagos.

export interface ICommissionRate {
  service: Types.ObjectId;
  percent: number; // 0..100
}

export interface ICommissionSetting extends Document {
  establishment: Types.ObjectId;
  rates: ICommissionRate[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const rateSchema = new Schema<ICommissionRate>(
  {
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const settingSchema = new Schema<ICommissionSetting>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
      unique: true,
    },
    rates: { type: [rateSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const CommissionSetting = model<ICommissionSetting>(
  "CommissionSetting",
  settingSchema
);