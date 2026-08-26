import { Schema, model, Document, Types } from "mongoose";

// Odontograma de um paciente num estabelecimento (um por cliente+estabelecimento).
// Guarda apenas os dentes que tem alguma marca (sparse): dente sem marca = higido.
// Notacao FDI (11-18, 21-28, 31-38, 41-48).
//
// Cada dente pode ter:
//  - status: condicao do DENTE INTEIRO (ausente, implante, coroa, canal...), opcional
//  - faces[]: condicoes por FACE (carie, restauracao, selante...) — face em
//    V (vestibular), O (oclusal/incisal), M (mesial), D (distal), L (lingual/palatina)

export interface IToothFace {
  face: string; // V | O | M | D | L
  status: string;
}

export interface IToothMark {
  number: number; // dente na notacao FDI
  status?: string; // condicao do dente inteiro (opcional)
  note?: string;
  faces?: IToothFace[];
}

export interface IOdontogram extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  teeth: IToothMark[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const faceSchema = new Schema<IToothFace>(
  {
    face: { type: String, required: true },
    status: { type: String, required: true },
  },
  { _id: false }
);

const toothSchema = new Schema<IToothMark>(
  {
    number: { type: Number, required: true },
    status: { type: String },
    note: { type: String, trim: true },
    faces: { type: [faceSchema], default: undefined },
  },
  { _id: false }
);

const odontogramSchema = new Schema<IOdontogram>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teeth: { type: [toothSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

odontogramSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const Odontogram = model<IOdontogram>("Odontogram", odontogramSchema);