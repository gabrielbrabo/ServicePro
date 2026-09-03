import { Schema, model, Document, Types } from "mongoose";

// Job de FOTOGRAFIA (extra da categoria fotografia, modulo "foto"). E do
// ESTABELECIMENTO: cada documento e um trabalho (ensaio/evento) com briefing,
// dados de contrato, valores e a galeria de entrega (fotos finais). Gera um
// PDF de contrato/briefing para enviar/assinar.

export type PhotoJobStatus =
  | "orcamento"
  | "contratado"
  | "em_producao"
  | "entregue"
  | "cancelado";

export interface IPhotoJob extends Document {
  establishment: Types.ObjectId;
  number: number; // sequencial por estabelecimento
  clientName: string;
  clientPhone: string;
  title: string; // titulo do job ("Casamento Ana & Joao")
  eventType: string; // casamento, book, corporativo, aniversario, ensaio...
  eventDate: string; // data do evento (texto/data)
  eventTime: string; // horario
  location: string; // local do ensaio/evento
  // briefing
  briefing: string; // o que o cliente quer (estilo, referencias, momentos)
  deliverables: string; // entregaveis (ex: "50 fotos tratadas + album")
  deliveryDeadline: string; // prazo de entrega
  // contrato / valores
  price: number; // valor total
  deposit: number; // sinal / entrada
  paymentMethod: "dinheiro" | "cartao" | "pix" | "outro";
  contractTerms: string; // clausulas / termos do contrato
  status: PhotoJobStatus;
  // entrega: link externo (Drive/WeTransfer/Pixieset) — sem upload das fotos
  deliveryLink: string;
  depositPostedToCash: boolean; // sinal ja lancado no caixa (ao "contratado")
  balancePostedToCash: boolean; // saldo ja lancado no caixa (ao "entregue")
  notes: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const photoJobSchema = new Schema<IPhotoJob>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    number: { type: Number, default: 0 },
    clientName: { type: String, default: "", trim: true },
    clientPhone: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    eventType: { type: String, default: "", trim: true },
    eventDate: { type: String, default: "", trim: true },
    eventTime: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    briefing: { type: String, default: "", trim: true },
    deliverables: { type: String, default: "", trim: true },
    deliveryDeadline: { type: String, default: "", trim: true },
    price: { type: Number, default: 0, min: 0 },
    deposit: { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["dinheiro", "cartao", "pix", "outro"],
      default: "pix",
    },
    contractTerms: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["orcamento", "contratado", "em_producao", "entregue", "cancelado"],
      default: "orcamento",
    },
    deliveryLink: { type: String, default: "", trim: true },
    depositPostedToCash: { type: Boolean, default: false },
    balancePostedToCash: { type: Boolean, default: false },
    notes: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

photoJobSchema.index({ establishment: 1, number: -1 });
photoJobSchema.index({ establishment: 1, status: 1, createdAt: -1 });

export const PhotoJob = model<IPhotoJob>("PhotoJob", photoJobSchema);
