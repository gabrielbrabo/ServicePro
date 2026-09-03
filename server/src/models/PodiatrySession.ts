import { Schema, model, Document, Types } from "mongoose";

// Atendimento datado de PODOLOGIA. Cada visita registra:
//  - findings: o MAPA DO PE (achados por regiao: calo, micose, unha encravada...)
//  - procedures: os PROCEDIMENTOS realizados
//  - beforePhotos / afterPhotos: ANTES/DEPOIS
//  - orientacoes e proxima visita
// Varios por paciente (datados), para acompanhar a evolucao entre atendimentos.

export type FootSide = "left" | "right";
export type FootView = "dorsal" | "plantar";

export interface IFinding {
  foot: FootSide; // pe (esquerdo/direito)
  view: FootView; // vista (dorso/planta)
  region: string; // regiao do mapa (chave: hallux, toes, forefoot, ...)
  condition: string; // achado (chave: calo, micose, unha_encravada, ...)
  severity: string; // "" | leve | moderado | grave
  note: string; // detalhe do achado
}

export interface IProcedure {
  name: string; // procedimento (ex.: "Remocao de calosidade")
  region: string; // regiao (opcional; texto livre)
  materials: string; // materiais / produtos usados
  note: string; // observacao / tecnica
}

export interface ISessionPhoto {
  url: string;
  note: string;
}

export interface IPodiatrySession extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem atendeu
  date: Date;
  findings: Types.DocumentArray<IFinding & Document>;
  procedures: Types.DocumentArray<IProcedure & Document>;
  beforePhotos: Types.DocumentArray<ISessionPhoto & Document>;
  afterPhotos: Types.DocumentArray<ISessionPhoto & Document>;
  recommendations: string; // orientacoes ao paciente
  notes: string; // observacoes gerais do atendimento
  nextVisit?: Date; // proxima visita sugerida
  createdAt: Date;
  updatedAt: Date;
}

const findingSchema = new Schema<IFinding>(
  {
    foot: { type: String, enum: ["left", "right"], default: "left" },
    view: { type: String, enum: ["dorsal", "plantar"], default: "dorsal" },
    region: { type: String, default: "", trim: true },
    condition: { type: String, default: "", trim: true },
    severity: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const procedureSchema = new Schema<IProcedure>(
  {
    name: { type: String, default: "", trim: true },
    region: { type: String, default: "", trim: true },
    materials: { type: String, default: "", trim: true },
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

const podiatrySessionSchema = new Schema<IPodiatrySession>(
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
    procedures: { type: [procedureSchema], default: [] },
    beforePhotos: { type: [sessionPhotoSchema], default: [] },
    afterPhotos: { type: [sessionPhotoSchema], default: [] },
    recommendations: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    nextVisit: { type: Date },
  },
  { timestamps: true }
);

podiatrySessionSchema.index({ establishment: 1, client: 1, date: -1 });

export const PodiatrySession = model<IPodiatrySession>(
  "PodiatrySession",
  podiatrySessionSchema
);
