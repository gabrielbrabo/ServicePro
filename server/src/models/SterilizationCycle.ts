import { Schema, model, Document, Types } from "mongoose";

// Registro de um CICLO DE ESTERILIZACAO do estabelecimento (biosseguranca,
// exigencia da vigilancia sanitaria — relevante p/ manicure/pedicure e afins).
// E do ESTABELECIMENTO (nao de um cliente): cada documento e um ciclo de
// autoclave com data, carga, parametros e resultado do indicador.

export type SterilizationIndicator = "aprovado" | "reprovado" | "na";

export interface ISterilizationCycle extends Document {
  establishment: Types.ObjectId;
  date: Date;
  equipment: string; // autoclave / equipamento
  load: string; // o que foi esterilizado (conjuntos, alicates...)
  cycle: string; // parametros (ex.: "134C 4min")
  indicator: SterilizationIndicator; // resultado do indicador
  responsible: string; // nome do responsavel pelo ciclo
  notes: string;
  author: Types.ObjectId; // quem registrou no sistema
  createdAt: Date;
  updatedAt: Date;
}

const sterilizationCycleSchema = new Schema<ISterilizationCycle>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    date: { type: Date, default: Date.now },
    equipment: { type: String, default: "", trim: true },
    load: { type: String, default: "", trim: true },
    cycle: { type: String, default: "", trim: true },
    indicator: {
      type: String,
      enum: ["aprovado", "reprovado", "na"],
      default: "na",
    },
    responsible: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

sterilizationCycleSchema.index({ establishment: 1, date: -1 });

export const SterilizationCycle = model<ISterilizationCycle>(
  "SterilizationCycle",
  sterilizationCycleSchema
);
