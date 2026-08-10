import { Schema, model, Document, Types } from "mongoose";

// Item da galeria (portfolio) de um estabelecimento: um par antes/depois.
// Publico: qualquer um ve na pagina do estabelecimento.
// professional e service sao opcionais (credito de quem fez / qual servico).

export interface IGalleryItem extends Document {
  establishment: Types.ObjectId;
  beforeUrl: string;
  afterUrl: string;
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
    beforeUrl: { type: String, required: true },
    afterUrl: { type: String, required: true },
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