import { Schema, model, Document, Types } from "mongoose";

// Ficha do PACIENTE (podologia): dados que nao mudam a cada atendimento —
// queixa principal, historico de saude relevante (diabetes, circulacao),
// tipo de pisada, calcado habitual, alergias e observacoes. Um documento por
// (establishment, client), criado sob demanda (upsert). Os atendimentos
// datados (mapa do pe + procedimentos + antes/depois) ficam em PodiatrySession.

export interface IFootPhoto {
  url: string;
  date: Date;
  note: string;
}

export interface IPodiatryProfile extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  mainComplaint: string; // queixa principal
  diabetic: boolean; // diabetico (pe diabetico: cuidado redobrado)
  circulationNotes: string; // circulacao / vascular (varizes, edema, etc.)
  footType: string; // "" | normal | plano (chato) | cavo
  footwear: string; // calcado habitual / atividade
  allergies: string; // alergias (anestesico topico, esparadrapo, etc.)
  healthNotes: string; // historico, medicamentos, observacoes gerais
  photos: Types.DocumentArray<IFootPhoto & Document>; // fotos de referencia
  createdAt: Date;
  updatedAt: Date;
}

const photoSchema = new Schema<IFootPhoto>(
  {
    url: { type: String, default: "", trim: true },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const podiatryProfileSchema = new Schema<IPodiatryProfile>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mainComplaint: { type: String, default: "", trim: true },
    diabetic: { type: Boolean, default: false },
    circulationNotes: { type: String, default: "", trim: true },
    footType: { type: String, default: "", trim: true },
    footwear: { type: String, default: "", trim: true },
    allergies: { type: String, default: "", trim: true },
    healthNotes: { type: String, default: "", trim: true },
    photos: { type: [photoSchema], default: [] },
  },
  { timestamps: true }
);

podiatryProfileSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const PodiatryProfile = model<IPodiatryProfile>(
  "PodiatryProfile",
  podiatryProfileSchema
);
