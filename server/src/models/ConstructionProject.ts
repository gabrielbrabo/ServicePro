import { Schema, model, Document, Types } from "mongoose";

// Obra de REFORMAS E CONSTRUCAO (extra da categoria reformas-construcao, modulo
// "obra"). E do ESTABELECIMENTO: cada documento e uma obra com orcamento por
// ETAPAS (cada etapa tem valor e % de avanco), MEDICOES (boletins que faturam o
// avanco e lancam no caixa) e visitas de acompanhamento na AGENDA (bookings
// recorrentes, agrupados por seriesId — igual as matriculas/manutencao).

export type ProjectStatus =
  | "orcamento"
  | "em_andamento"
  | "concluida"
  | "cancelada";

export type ProjectFrequency =
  | "diaria"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "personalizada";

// etapa do orcamento
export interface IProjectStage {
  name: string; // ex: "Fundacao", "Alvenaria", "Acabamento"
  value: number; // valor orcado da etapa
  progress: number; // avanco atual 0-100 (%)
}

// medicao (boletim): fatura o avanco de um periodo e entra no caixa
export interface IProjectMeasurement {
  date: string; // data da medicao (texto/data)
  note: string;
  amount: number; // valor faturado nesta medicao
  method: "dinheiro" | "cartao" | "pix" | "outro";
  postedToCash: boolean; // ja lancado no caixa
  createdAt: Date;
}

export interface IConstructionProject extends Document {
  establishment: Types.ObjectId;
  number: number; // sequencial por estabelecimento (Obra #)
  client: Types.ObjectId | null; // cliente cadastrado (p/ agenda)
  clientName: string;
  clientPhone: string;
  title: string; // nome da obra
  location: string;
  status: ProjectStatus;
  stages: Types.DocumentArray<IProjectStage & Document>;
  measurements: Types.DocumentArray<IProjectMeasurement & Document>;
  // agenda (visitas de acompanhamento / medicao)
  service: Types.ObjectId | null;
  professional: Types.ObjectId | null;
  startDate: string; // 1a visita "YYYY-MM-DD"
  time: string; // "HH:mm"
  frequency: ProjectFrequency;
  visitsCount: number;
  seriesId: Types.ObjectId | null;
  notes: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const stageSchema = new Schema<IProjectStage>(
  {
    name: { type: String, default: "", trim: true },
    value: { type: Number, default: 0, min: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const measurementSchema = new Schema<IProjectMeasurement>(
  {
    date: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
    amount: { type: Number, default: 0, min: 0 },
    method: {
      type: String,
      enum: ["dinheiro", "cartao", "pix", "outro"],
      default: "pix",
    },
    postedToCash: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FREQUENCIES = [
  "diaria",
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "personalizada",
];

const constructionProjectSchema = new Schema<IConstructionProject>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    number: { type: Number, default: 0 },
    client: { type: Schema.Types.ObjectId, ref: "User", default: null },
    clientName: { type: String, default: "", trim: true },
    clientPhone: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["orcamento", "em_andamento", "concluida", "cancelada"],
      default: "orcamento",
    },
    stages: { type: [stageSchema], default: [] },
    measurements: { type: [measurementSchema], default: [] },
    service: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    professional: { type: Schema.Types.ObjectId, default: null },
    startDate: { type: String, default: "", trim: true },
    time: { type: String, default: "", trim: true },
    frequency: { type: String, enum: FREQUENCIES, default: "mensal" },
    visitsCount: { type: Number, default: 4, min: 1, max: 53 },
    seriesId: { type: Schema.Types.ObjectId, default: null },
    notes: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

constructionProjectSchema.index({ establishment: 1, number: -1 });
constructionProjectSchema.index({ establishment: 1, status: 1, updatedAt: -1 });

// valor orcado (soma das etapas)
export function projectBudget(stages: { value: number }[]): number {
  return Math.round(
    stages.reduce((s, e) => s + (Number(e.value) || 0), 0) * 100
  ) / 100;
}
// valor executado (soma de valor*avanco de cada etapa)
export function projectExecuted(
  stages: { value: number; progress: number }[]
): number {
  const total = stages.reduce(
    (s, e) =>
      s + (Number(e.value) || 0) * (Math.min(100, Math.max(0, Number(e.progress) || 0)) / 100),
    0
  );
  return Math.round(total * 100) / 100;
}

export const ConstructionProject = model<IConstructionProject>(
  "ConstructionProject",
  constructionProjectSchema
);
