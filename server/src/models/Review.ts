import { Schema, model, Document, Types } from "mongoose";

// Avaliacao de um atendimento CONCLUIDO, feita pelo cliente.
// Regra: UMA avaliacao por (cliente + servico). Se o cliente ja avaliou
// "Corte" naquele estabelecimento, nao avalia "Corte" de novo (mesmo em outro
// agendamento) — reavaliar apenas sobrescreve a nota anterior daquele servico.
// A nota agregada do estabelecimento (ratingAvg/ratingCount) e recalculada no
// reviewController a cada avaliacao.
export interface IReview extends Document {
  client: Types.ObjectId;
  establishment: Types.ObjectId;
  service: Types.ObjectId; // servico avaliado (chave da unicidade junto do cliente)
  booking: Types.ObjectId; // agendamento que originou a avaliacao (informativo)
  // _id do subdoc do profissional (Establishment.professionals); guardado para
  // futuras estatisticas por profissional. Opcional.
  professional: Types.ObjectId | null;
  rating: number; // 1 a 5 estrelas
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    professional: { type: Schema.Types.ObjectId, default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

// UMA avaliacao por cliente + servico
reviewSchema.index({ client: 1, service: 1 }, { unique: true });
// listagem/agregacao por estabelecimento
reviewSchema.index({ establishment: 1, createdAt: -1 });

export const Review = model<IReview>("Review", reviewSchema);