import { Schema, model, Document, Types } from "mongoose";

// Ficha de uma TATUAGEM de um cliente (categoria tatuagem, area Beleza).
// Cada documento e uma peca/projeto, com suas sessoes (data + cicatrizacao).

export interface ITattooSession {
  _id: Types.ObjectId;
  date: Date;
  note: string; // o que foi feito na sessao
  healing: string; // observacao de cicatrizacao / cuidados
  by: Types.ObjectId;
}

export type TattooStatus = "orcamento" | "em_andamento" | "concluido";

export interface IBeautyTattoo extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  title: string; // nome/descricao da tatuagem
  bodyRegion: string; // regiao do corpo
  size: string; // tamanho (ex.: "15cm")
  style: string; // estilo (fineline, blackwork, realismo...)
  referenceUrl: string; // imagem da arte/referencia
  sessionsPlanned: number; // sessoes previstas
  sessions: Types.DocumentArray<ITattooSession>;
  status: TattooStatus;
  quotePrice: number; // valor total do orcamento
  depositPaid: number; // sinal pago para segurar a data
  aftercare: string; // cuidados pos (aftercare)
  notes: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tattooSessionSchema = new Schema<ITattooSession>({
  date: { type: Date, default: Date.now },
  note: { type: String, default: "", trim: true },
  healing: { type: String, default: "", trim: true },
  by: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

const beautyTattooSchema = new Schema<IBeautyTattoo>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "", trim: true },
    bodyRegion: { type: String, default: "", trim: true },
    size: { type: String, default: "", trim: true },
    style: { type: String, default: "", trim: true },
    referenceUrl: { type: String, default: "" },
    sessionsPlanned: { type: Number, default: 1, min: 1 },
    sessions: { type: [tattooSessionSchema], default: [] },
    status: {
      type: String,
      enum: ["orcamento", "em_andamento", "concluido"],
      default: "orcamento",
    },
    quotePrice: { type: Number, default: 0, min: 0 },
    depositPaid: { type: Number, default: 0, min: 0 },
    aftercare: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

beautyTattooSchema.index({ establishment: 1, client: 1, createdAt: -1 });

export const BeautyTattoo = model<IBeautyTattoo>(
  "BeautyTattoo",
  beautyTattooSchema
);
