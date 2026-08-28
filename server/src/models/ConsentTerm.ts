import { Schema, model, Document, Types } from "mongoose";

// Termo de consentimento / autorizacao de um CLIENTE (area Beleza).
// Ex.: consentimento de procedimento, autorizacao de uso de imagem.
// `signedAt` marca quando foi aceito; `attachmentUrl` guarda a foto do
// documento assinado em papel (opcional). Registro leve, nao e assinatura
// digital com validade juridica.

export type ConsentKind = "procedimento" | "imagem" | "outro";

export interface IConsentTerm extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  kind: ConsentKind;
  title: string;
  content: string;
  signedName: string; // nome de quem assinou/autorizou
  signedAt: Date | null; // null enquanto nao aceito
  attachmentUrl: string; // foto do documento assinado (opcional)
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const consentTermSchema = new Schema<IConsentTerm>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: {
      type: String,
      enum: ["procedimento", "imagem", "outro"],
      default: "procedimento",
    },
    title: { type: String, default: "", trim: true },
    content: { type: String, default: "", trim: true },
    signedName: { type: String, default: "", trim: true },
    signedAt: { type: Date, default: null },
    attachmentUrl: { type: String, default: "" },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

consentTermSchema.index({ establishment: 1, client: 1, createdAt: -1 });

export const ConsentTerm = model<IConsentTerm>(
  "ConsentTerm",
  consentTermSchema
);
