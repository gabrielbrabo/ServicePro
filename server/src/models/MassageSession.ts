import { Schema, model, Document, Types } from "mongoose";

// Sessao de massagem de um cliente: evolucao por atendimento, com escala de
// dor (EVA 0-10) antes e depois para acompanhar a resposta ao tratamento.
// painBefore/painAfter: 0..10 ou null quando nao avaliado.

export interface IMassageSession extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  date: Date;
  technique: string; // tecnica aplicada (relaxante, drenagem, desportiva...)
  regions: string; // regioes trabalhadas
  evolution: string; // resposta / evolucao
  painBefore: number | null;
  painAfter: number | null;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const massageSessionSchema = new Schema<IMassageSession>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    technique: { type: String, default: "", trim: true },
    regions: { type: String, default: "", trim: true },
    evolution: { type: String, default: "", trim: true },
    painBefore: { type: Number, default: null, min: 0, max: 10 },
    painAfter: { type: Number, default: null, min: 0, max: 10 },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

massageSessionSchema.index({ establishment: 1, client: 1, date: -1 });

export const MassageSession = model<IMassageSession>(
  "MassageSession",
  massageSessionSchema
);
