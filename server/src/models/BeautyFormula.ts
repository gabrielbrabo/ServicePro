import { Schema, model, Document, Types } from "mongoose";

// Registro de FORMULA quimica aplicada num cliente, para reproduzir na proxima
// visita (coloracao, mechas, alisamento...). Um documento por aplicacao; a
// listagem por cliente devolve o historico em ordem decrescente de data.

export interface IBeautyFormula extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  date: Date; // data da aplicacao
  category: string; // coloracao, luzes/mechas, alisamento, matizacao, outro
  service: Types.ObjectId | null; // servico relacionado (opcional)
  brand: string; // marca do produto
  formula: string; // a formula em si (tons, proporcao)
  oxidant: string; // volume do oxidante (ex.: "20 vol")
  timeMinutes: number; // tempo de acao
  result: string; // resultado / observacao
  author: Types.ObjectId; // quem registrou
  createdAt: Date;
  updatedAt: Date;
}

const beautyFormulaSchema = new Schema<IBeautyFormula>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    category: { type: String, default: "", trim: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    brand: { type: String, default: "", trim: true },
    formula: { type: String, default: "", trim: true },
    oxidant: { type: String, default: "", trim: true },
    timeMinutes: { type: Number, default: 0, min: 0 },
    result: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

beautyFormulaSchema.index({ establishment: 1, client: 1, date: -1 });

export const BeautyFormula = model<IBeautyFormula>(
  "BeautyFormula",
  beautyFormulaSchema
);
