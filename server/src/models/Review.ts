import { Schema, model, Document, Types } from "mongoose";

export interface IReview extends Document {
  author: Types.ObjectId;
  provider: Types.ObjectId;
  service: Types.ObjectId;
  booking: Types.ObjectId;
  rating: number; // 1 a 5
  comment?: string;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Uma avaliacao por agendamento
reviewSchema.index({ booking: 1 }, { unique: true });

export const Review = model<IReview>("Review", reviewSchema);
