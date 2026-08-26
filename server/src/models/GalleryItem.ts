import { Schema, model, Document, Types } from "mongoose";

// Item da galeria (portfolio) de um estabelecimento.
// Dois tipos (kind): "ba" = par antes/depois; "single" = foto normal (uma so).
// Publico: qualquer um ve na pagina do estabelecimento.
// professional e service sao opcionais (credito de quem fez / qual servico).

export type GalleryKind = "ba" | "single";

export interface IGalleryItem extends Document {
  establishment: Types.ObjectId;
  kind: GalleryKind;
  beforeUrl?: string; // usado no "ba"
  afterUrl?: string; // usado no "ba"
  photoUrl?: string; // usado no "single"
  title: string;
  description: string;
  professional: Types.ObjectId | null; // subdoc em Establishment.professionals
  service: Types.ObjectId | null;
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const galleryItemSchema = new Schema<IGalleryItem>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    kind: { type: String, enum: ["ba", "single"], default: "ba" },
    beforeUrl: { type: String },
    afterUrl: { type: String },
    photoUrl: { type: String },
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    // id do profissional (subdoc); null = sem credito
    professional: { type: Schema.Types.ObjectId, default: null },
    service: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// listagem publica por estabelecimento, mais recentes primeiro
galleryItemSchema.index({ establishment: 1, active: 1, createdAt: -1 });

export const GalleryItem = model<IGalleryItem>(
  "GalleryItem",
  galleryItemSchema
);