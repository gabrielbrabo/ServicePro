import { Schema, model, Document, Types } from "mongoose";

// Ficha do PACIENTE (dermatologia): dados que nao mudam a cada atendimento —
// fototipo (Fitzpatrick), antecedentes (cancer de pele, exposicao solar),
// alergias, medicacoes e observacoes. Um documento por (establishment, client),
// upsert. Os atendimentos datados (mapa de lesoes + antes/depois) ficam em
// DermatologySession.

export interface IRefPhoto {
  url: string;
  date: Date;
  note: string;
}

export interface IDermatologyProfile extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  phototype: string; // "" | I..VI (Fitzpatrick)
  mainComplaint: string; // queixa principal
  skinCancerHistory: string; // antecedentes pessoais/familiares de cancer de pele
  sunExposure: string; // exposicao solar / fotoprotecao
  allergies: string; // alergias
  medications: string; // medicacoes em uso
  healthNotes: string; // observacoes gerais
  photos: Types.DocumentArray<IRefPhoto & Document>; // fotos de referencia
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

const dermatologyProfileSchema = new Schema<IDermatologyProfile>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    phototype: { type: String, default: "", trim: true },
    mainComplaint: { type: String, default: "", trim: true },
    skinCancerHistory: { type: String, default: "", trim: true },
    sunExposure: { type: String, default: "", trim: true },
    allergies: { type: String, default: "", trim: true },
    medications: { type: String, default: "", trim: true },
    healthNotes: { type: String, default: "", trim: true },
    photos: { type: [photoSchema], default: [] },
  },
  { timestamps: true }
);

dermatologyProfileSchema.index(
  { establishment: 1, client: 1 },
  { unique: true }
);

export const DermatologyProfile = model<IDermatologyProfile>(
  "DermatologyProfile",
  dermatologyProfileSchema
);
