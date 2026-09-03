import { Schema, model, Document, Types } from "mongoose";

// Atendimento datado de QUIROPRAXIA. Cada visita registra:
//  - eva: dor (0-10)
//  - posture: AVALIACAO POSTURAL ESTRUTURADA (chaves de opcao por segmento)
//  - posturePhotos: fotos posturais (anterior/posterior/lateral)
//  - adjustments: REGISTRO DE AJUSTES (segmento, tecnica, lado)
//  - orientacoes e proxima visita
// Varios por paciente (datados) → acompanhamento da evolucao (EVA, postura).

export interface IPosture {
  head: string; // cabeca
  shoulders: string; // ombros
  pelvis: string; // pelve
  cervical: string; // curvatura cervical
  thoracic: string; // curvatura toracica
  lumbar: string; // curvatura lombar
  scoliosis: string; // escoliose
  notes: string;
}

export interface IAdjustment {
  segment: string; // segmento (ex.: C1, T4, L5, SI D)
  technique: string; // tecnica (diversificada, thompson, activator...)
  side: string; // "" | D | E | bilateral | central
  note: string;
}

export interface ISessionPhoto {
  url: string;
  view: string; // anterior | posterior | lateral_d | lateral_e
  note: string;
}

export interface IChiropracticSession extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem atendeu
  date: Date;
  eva: number; // dor 0-10
  posture: IPosture;
  posturePhotos: Types.DocumentArray<ISessionPhoto & Document>;
  adjustments: Types.DocumentArray<IAdjustment & Document>;
  recommendations: string;
  notes: string;
  nextVisit?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const postureSchema = new Schema<IPosture>(
  {
    head: { type: String, default: "", trim: true },
    shoulders: { type: String, default: "", trim: true },
    pelvis: { type: String, default: "", trim: true },
    cervical: { type: String, default: "", trim: true },
    thoracic: { type: String, default: "", trim: true },
    lumbar: { type: String, default: "", trim: true },
    scoliosis: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const adjustmentSchema = new Schema<IAdjustment>(
  {
    segment: { type: String, default: "", trim: true },
    technique: { type: String, default: "", trim: true },
    side: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const sessionPhotoSchema = new Schema<ISessionPhoto>(
  {
    url: { type: String, default: "", trim: true },
    view: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const chiropracticSessionSchema = new Schema<IChiropracticSession>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    eva: { type: Number, default: 0, min: 0, max: 10 },
    posture: { type: postureSchema, default: () => ({}) },
    posturePhotos: { type: [sessionPhotoSchema], default: [] },
    adjustments: { type: [adjustmentSchema], default: [] },
    recommendations: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    nextVisit: { type: Date },
  },
  { timestamps: true }
);

chiropracticSessionSchema.index({ establishment: 1, client: 1, date: -1 });

export const ChiropracticSession = model<IChiropracticSession>(
  "ChiropracticSession",
  chiropracticSessionSchema
);
