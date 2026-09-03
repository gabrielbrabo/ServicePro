import { Schema, model, Document, Types } from "mongoose";

// Avaliacao de um atendimento CONCLUIDO, feita pelo cliente.
// Regra: UMA avaliacao por ATENDIMENTO (booking). Cada visita concluida pode
// ter a propria avaliacao — clientes que voltam avaliam de novo, aumentando o
// total. Reavaliar o MESMO atendimento sobrescreve a nota daquele atendimento.
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

// UMA avaliacao por atendimento (booking)
reviewSchema.index({ booking: 1 }, { unique: true });
// listagem/agregacao por estabelecimento
reviewSchema.index({ establishment: 1, createdAt: -1 });

export const Review = model<IReview>("Review", reviewSchema);