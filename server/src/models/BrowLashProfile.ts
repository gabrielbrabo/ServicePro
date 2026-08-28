import { Schema, model, Document, Types } from "mongoose";

// Perfil tecnico de SOBRANCELHA & CILIOS de um cliente (categoria
// sobrancelha-cilios, area Beleza). Um por (cliente + estabelecimento).
// Guarda a "receita" que reproduz o visual: design da sobrancelha e o
// mapping dos cilios por zona do olho.

export interface ILashMapZone {
  zone: string; // slug da zona (ex.: "canto_interno")
  length: string; // comprimento (ex.: "9mm") — texto livre
}

export interface IBrowLashProfile extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  // sobrancelha
  faceShape: string; // formato do rosto
  browFormat: string; // formato ideal da sobrancelha
  browTechnique: string; // henna, laminacao, micropigmentacao, design...
  browColor: string; // cor/tom usado
  browMeasures: string; // medidas: inicio / apice / termino
  browNotes: string;
  // cilios
  lashTechnique: string; // fio a fio, volume 2D-6D...
  lashCurvature: string; // C, D, L...
  lashThickness: string; // 0.05, 0.07...
  lashGlue: string; // cola usada
  lashMap: Types.DocumentArray<ILashMapZone>;
  lashNotes: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lashMapZoneSchema = new Schema<ILashMapZone>(
  {
    zone: { type: String, required: true, trim: true },
    length: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const browLashProfileSchema = new Schema<IBrowLashProfile>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    faceShape: { type: String, default: "", trim: true },
    browFormat: { type: String, default: "", trim: true },
    browTechnique: { type: String, default: "", trim: true },
    browColor: { type: String, default: "", trim: true },
    browMeasures: { type: String, default: "", trim: true },
    browNotes: { type: String, default: "", trim: true },
    lashTechnique: { type: String, default: "", trim: true },
    lashCurvature: { type: String, default: "", trim: true },
    lashThickness: { type: String, default: "", trim: true },
    lashGlue: { type: String, default: "", trim: true },
    lashMap: { type: [lashMapZoneSchema], default: [] },
    lashNotes: { type: String, default: "", trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

browLashProfileSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const BrowLashProfile = model<IBrowLashProfile>(
  "BrowLashProfile",
  browLashProfileSchema
);
