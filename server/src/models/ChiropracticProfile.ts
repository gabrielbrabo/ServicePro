import { Schema, model, Document, Types } from "mongoose";

// Ficha do PACIENTE (quiropraxia): dados que nao mudam a cada atendimento —
// queixa principal, historico, contraindicacoes/red flags, medicacoes e
// observacoes. Um documento por (establishment, client), upsert. As avaliacoes
// posturais e os ajustes datados ficam em ChiropracticSession.

export interface IRefPhoto {
  url: string;
  date: Date;
  note: string;
}

export interface IChiropracticProfile extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  mainComplaint: string; // queixa principal
  history: string; // historico / inicio dos sintomas
  contraindications: string; // red flags / contraindicacoes a manipulacao
  medications: string; // medicacoes em uso
  activity: string; // atividade / ergonomia / esporte
  healthNotes: string; // observacoes gerais
  photos: Types.DocumentArray<IRefPhoto & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const photoSchema = new Schema<IRefPhoto>(
  {
    url: { type: String, default: "", trim: true },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const chiropracticProfileSchema = new Schema<IChiropracticProfile>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mainComplaint: { type: String, default: "", trim: true },
    history: { type: String, default: "", trim: true },
    contraindications: { type: String, default: "", trim: true },
    medications: { type: String, default: "", trim: true },
    activity: { type: String, default: "", trim: true },
    healthNotes: { type: String, default: "", trim: true },
    photos: { type: [photoSchema], default: [] },
  },
  { timestamps: true }
);

chiropracticProfileSchema.index(
  { establishment: 1, client: 1 },
  { unique: true }
);

export const ChiropracticProfile = model<IChiropracticProfile>(
  "ChiropracticProfile",
  chiropracticProfileSchema
);
