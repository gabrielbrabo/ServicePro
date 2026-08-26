import { Schema, model, Document, Types } from "mongoose";

// Registro (auditoria) de um documento emitido para um paciente. Guarda apenas
// os METADADOS — nao o PDF. Serve de historico: o que foi emitido, para quem,
// por quem e quando. Os nomes/registro sao "snapshots" (copia do momento da
// emissao), para o historico nao mudar se o perfil for editado depois.

export interface IEmittedDocument extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  issuer?: Types.ObjectId; // usuario que emitiu
  type: string; // atestado | declaracao | receita | pedido_exame
  patientName?: string;
  issuerName?: string; // nome do emissor no momento
  council?: string; // registro do emissor no momento (ex: CRO-SP 12345)
  summary?: string; // resumo curto (ex: "3 dia(s) · CID J06")
  // assinatura digital (Clicksign)
  signatureStatus: "nao_assinado" | "pendente" | "assinado" | "falhou";
  signatureProvider?: string; // ex: "clicksign"
  signatureRequestId?: string; // id do envelope no provedor
  signedUrl?: string; // url do PDF assinado
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emittedDocumentSchema = new Schema<IEmittedDocument>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    issuer: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true },
    patientName: { type: String, trim: true },
    issuerName: { type: String, trim: true },
    council: { type: String, trim: true },
    summary: { type: String, trim: true },
    signatureStatus: {
      type: String,
      enum: ["nao_assinado", "pendente", "assinado", "falhou"],
      default: "nao_assinado",
    },
    signatureProvider: { type: String, trim: true },
    signatureRequestId: { type: String, trim: true, index: true },
    signedUrl: { type: String, trim: true },
    signedAt: { type: Date },
  },
  { timestamps: true }
);

// consultas por paciente e por estabelecimento, sempre do mais novo ao mais antigo
emittedDocumentSchema.index({ establishment: 1, client: 1, createdAt: -1 });
emittedDocumentSchema.index({ establishment: 1, createdAt: -1 });

export const EmittedDocument = model<IEmittedDocument>(
  "EmittedDocument",
  emittedDocumentSchema
);