import { Schema, model, Document, Types } from "mongoose";

// Codigo TUSS padrao de cada servico do estabelecimento (editavel na guia).
// Um documento por estabelecimento (config), no mesmo estilo das comissoes —
// assim nao precisamos alterar o model de Servico.

export interface ITussCode {
  service: Types.ObjectId;
  code: string; // codigo TUSS
  description?: string; // descricao do procedimento
}

export interface ITussSetting extends Document {
  establishment: Types.ObjectId;
  codes: ITussCode[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const codeSchema = new Schema<ITussCode>(
  {
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    code: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const tussSchema = new Schema<ITussSetting>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
      unique: true,
    },
    codes: { type: [codeSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const TussSetting = model<ITussSetting>("TussSetting", tussSchema);
