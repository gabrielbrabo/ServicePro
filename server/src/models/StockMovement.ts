import { Schema, model, Document, Types } from "mongoose";

// Movimentacao de estoque de um produto.
//
// type:
// - entrada: compra/reposicao (aumenta)
// - saida: venda manual, perda, uso interno (diminui)
// - inventario: ajuste por contagem fisica (define o valor absoluto)
//
// quantity: sempre positivo. O efeito no estoque depende do type.
// Para inventario, quantity e o valor CONTADO (novo estoque).
//
// stockBefore/stockAfter: saldo antes e depois, congelados para auditoria.

export type StockMovementType = "entrada" | "saida" | "inventario";

export interface IStockMovement extends Document {
  establishment: Types.ObjectId;
  product: Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  unitCost: number; // custo unitario na entrada (opcional)
  createdBy: Types.ObjectId;
  booking: Types.ObjectId | null; // reservado para baixa automatica futura
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    type: {
      type: String,
      enum: ["entrada", "saida", "inventario"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    reason: { type: String, default: "" },
    unitCost: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true }
);

// historico por produto, mais recentes primeiro
stockMovementSchema.index({ product: 1, createdAt: -1 });
// listagem geral do estabelecimento
stockMovementSchema.index({ establishment: 1, createdAt: -1 });

export const StockMovement = model<IStockMovement>(
  "StockMovement",
  stockMovementSchema
);