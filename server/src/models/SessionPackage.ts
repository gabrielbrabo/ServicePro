import { Schema, model, Document, Types } from "mongoose";

// Pacote de sessoes de um PACIENTE num ESTABELECIMENTO (ex.: fisioterapia:
// "comprou 10 sessoes, usou 3"). Controla o saldo. Um paciente pode ter varios
// pacotes ao longo do tempo. Cada sessao usada guarda data e quem registrou.

export interface ISessionUse {
  _id: Types.ObjectId;
  date: Date;
  by: Types.ObjectId; // quem registrou a sessao
  note?: string;
}

export interface ISessionPackage extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  title: string;
  totalSessions: number;
  uses: Types.DocumentArray<ISessionUse>; // sessoes efetivamente usadas
  price: number; // valor do pacote (informativo)
  notes: string;
  status: "ativo" | "concluido" | "cancelado";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sessionUseSchema = new Schema<ISessionUse>({
  date: { type: Date, default: Date.now },
  by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  note: { type: String, trim: true },
});

const sessionPackageSchema = new Schema<ISessionPackage>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "Pacote de sessoes", trim: true },
    totalSessions: { type: Number, required: true, min: 1, default: 10 },
    uses: { type: [sessionUseSchema], default: [] },
    price: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["ativo", "concluido", "cancelado"],
      default: "ativo",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

sessionPackageSchema.index({ establishment: 1, client: 1, createdAt: -1 });

export const SessionPackage = model<ISessionPackage>(
  "SessionPackage",
  sessionPackageSchema
);
