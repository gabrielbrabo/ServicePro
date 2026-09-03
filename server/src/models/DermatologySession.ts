import { Schema, model, Document, Types } from "mongoose";

// Atendimento datado de DERMATOLOGIA. Cada visita registra:
//  - findings: o MAPA DE LESOES/PINTAS (por regiao do corpo, com tipo, tamanho,
//    cor e criterios ABCDE de monitoramento)
//  - beforePhotos / afterPhotos: ANTES/DEPOIS
//  - orientacoes e proxima visita
// Varios por paciente (datados) → permite acompanhar a evolucao por regiao.

export type BodyView = "front" | "back";

export interface IDermFinding {
  region: string; // regiao do corpo (chave)
  view: BodyView; // frente / costas
  type: string; // tipo (pinta, mancha, lesao, verruga, queratose, ...)
  size: number; // maior diametro em mm (0 = nao medido)
  color: string; // cor (texto)
  abcde: string[]; // criterios presentes: A, B, C, D, E
  note: string; // descricao / conduta
}

export interface ISessionPhoto {
  url: string;
  note: string;
}

export interface IDermatologySession extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem atendeu
  date: Date;
  findings: Types.DocumentArray<IDermFinding & Document>;
  beforePhotos: Types.DocumentArray<ISessionPhoto & Document>;
  afterPhotos: Types.DocumentArray<ISessionPhoto & Document>;
  recommendations: string; // orientacoes ao paciente
  notes: string; // observacoes gerais
  nextVisit?: Date; // proxima visita (espelha o agendamento na agenda)
  createdAt: Date;
  updatedAt: Date;
}

const findingSchema = new Schema<IDermFinding>(
  {
    region: { type: String, default: "", trim: true },
    view: { type: String, enum: ["front", "back"], default: "front" },
    type: { type: String, default: "", trim: true },
    size: { type: Number, default: 0, min: 0 },
    color: { type: String, default: "", trim: true },
    abcde: { type: [String], default: [] },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const sessionPhotoSchema = new Schema<ISessionPhoto>(
  {
    url: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const dermatologySessionSchema = new Schema<IDermatologySession>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    findings: { type: [findingSchema], default: [] },
    beforePhotos: { type: [sessionPhotoSchema], default: [] },
    afterPhotos: { type: [sessionPhotoSchema], default: [] },
    recommendations: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    nextVisit: { type: Date },
  },
  { timestamps: true }
);

dermatologySessionSchema.index({ establishment: 1, client: 1, date: -1 });

export const DermatologySession = model<IDermatologySession>(
  "DermatologySession",
  dermatologySessionSchema
);
