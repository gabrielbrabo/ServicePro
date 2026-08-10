import { Schema, model, Document, Types } from "mongoose";

export interface IService extends Document {
  establishment: Types.ObjectId; // estabelecimento dono do servico
  category: Types.ObjectId;
  title: string;
  description: string;
  price: number;
  durationMinutes: number; // duracao estimada do servico
  photos: string[];
  professionals: Types.ObjectId[]; // quais profissionais fazem; [] = todos
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, default: 60 },
    photos: [{ type: String }],
    // ids dos profissionais (subdoc em Establishment.professionals) que fazem
    // este servico. [] = todos os profissionais ativos fazem.
    professionals: { type: [Schema.Types.ObjectId], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indices para busca
serviceSchema.index({ establishment: 1, active: 1 });
serviceSchema.index({ category: 1, active: 1 });
serviceSchema.index({ title: "text", description: "text" });

export const Service = model<IService>("Service", serviceSchema);