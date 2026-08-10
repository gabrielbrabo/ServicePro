import { Schema, model, Document, Types } from "mongoose";

// Produto vendido por um estabelecimento (shampoo, pomada, etc).
//
// stock: quantidade atual em estoque. E atualizado pelas movimentacoes
// (StockMovement) na etapa seguinte; aqui e definido no cadastro.
// minStock: alerta quando o estoque fica igual ou abaixo disso.

export interface IProduct extends Document {
  establishment: Types.ObjectId;
  name: string;
  description: string;
  photo: string;
  price: number; // preco de venda
  cost: number; // custo de compra (para margem)
  stock: number;
  minStock: number;
  supplier: string;
  barcode: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    photo: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    supplier: { type: String, default: "", trim: true },
    barcode: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ establishment: 1, active: 1 });
productSchema.index({ establishment: 1, name: 1 });
// busca por codigo de barras dentro do estabelecimento
productSchema.index({ establishment: 1, barcode: 1 });

export const Product = model<IProduct>("Product", productSchema);