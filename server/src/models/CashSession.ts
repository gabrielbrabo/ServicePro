import { Schema, model, Document, Types } from "mongoose";

export type CashSessionStatus = "aberto" | "fechado";

// Linha do relatorio: um movimento congelado no fechamento
export interface IReportLine {
  type: "entrada" | "saida" | "sangria" | "suprimento";
  method: "dinheiro" | "cartao" | "pix" | "outro";
  amount: number;
  description: string;
  professionalName: string | null;
  createdAt: Date;
}

// Snapshot completo gravado no fechamento do caixa
export interface ICashReport {
  openingAmount: number;
  byMethod: {
    dinheiro: number;
    cartao: number;
    pix: number;
    outro: number;
  };
  byType: {
    entrada: number;
    saida: number;
    sangria: number;
    suprimento: number;
  };
  expectedCash: number;
  countedAmount: number;
  difference: number;
  totalRevenue: number; // soma das entradas (todas as formas)
  movementCount: number;
  lines: IReportLine[];
  generatedAt: Date;
}

export interface ICashSession extends Document {
  establishment: Types.ObjectId;
  openedBy: Types.ObjectId;
  status: CashSessionStatus;
  openingAmount: number;
  openedAt: Date;
  closedBy?: Types.ObjectId;
  closedAt?: Date;
  expectedAmount?: number;
  countedAmount?: number;
  difference?: number;
  closingNotes?: string;
  report?: ICashReport;
  createdAt: Date;
  updatedAt: Date;
}

const reportLineSchema = new Schema<IReportLine>(
  {
    type: {
      type: String,
      enum: ["entrada", "saida", "sangria", "suprimento"],
      required: true,
    },
    method: {
      type: String,
      enum: ["dinheiro", "cartao", "pix", "outro"],
      required: true,
    },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    professionalName: { type: String, default: null },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const cashReportSchema = new Schema<ICashReport>(
  {
    openingAmount: { type: Number, required: true },
    byMethod: {
      dinheiro: { type: Number, default: 0 },
      cartao: { type: Number, default: 0 },
      pix: { type: Number, default: 0 },
      outro: { type: Number, default: 0 },
    },
    byType: {
      entrada: { type: Number, default: 0 },
      saida: { type: Number, default: 0 },
      sangria: { type: Number, default: 0 },
      suprimento: { type: Number, default: 0 },
    },
    expectedCash: { type: Number, required: true },
    countedAmount: { type: Number, required: true },
    difference: { type: Number, required: true },
    totalRevenue: { type: Number, default: 0 },
    movementCount: { type: Number, default: 0 },
    lines: { type: [reportLineSchema], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cashSessionSchema = new Schema<ICashSession>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["aberto", "fechado"],
      default: "aberto",
    },
    openingAmount: { type: Number, required: true, min: 0, default: 0 },
    openedAt: { type: Date, default: Date.now },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    expectedAmount: { type: Number },
    countedAmount: { type: Number },
    difference: { type: Number },
    closingNotes: { type: String, default: "" },
    report: { type: cashReportSchema, default: undefined },
  },
  { timestamps: true }
);

cashSessionSchema.index({ establishment: 1, status: 1 });
cashSessionSchema.index(
  { establishment: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "aberto" },
  }
);

export const CashSession = model<ICashSession>(
  "CashSession",
  cashSessionSchema
);