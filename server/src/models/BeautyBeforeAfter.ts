import { Schema, model, Document, Types } from "mongoose";

// Registro ANTES & DEPOIS de um CLIENTE (area Beleza). Privado: so dono/equipe
// acessam (diferente da Galeria, que e o portfolio publico do estabelecimento).
// Um documento por par de fotos; a listagem por cliente vem em ordem
// decrescente de data.

export interface IBeautyBeforeAfter extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  beforeUrl: string;
  afterUrl: string;
  note: string;
  service: Types.ObjectId | null;
  date: Date;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const beautyBeforeAfterSchema = new Schema<IBeautyBeforeAfter>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    beforeUrl: { type: String, default: "" },
    afterUrl: { type: String, default: "" },
    note: { type: String, default: "", trim: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    date: { type: Date, default: Date.now },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

beautyBeforeAfterSchema.index({ establishment: 1, client: 1, date: -1 });

export const BeautyBeforeAfter = model<IBeautyBeforeAfter>(
  "BeautyBeforeAfter",
  beautyBeforeAfterSchema
);
