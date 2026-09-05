import { Schema, model, Document, Types } from "mongoose";

export type MovementType = "entrada" | "saida" | "sangria" | "suprimento";
export type PaymentMethod = "dinheiro" | "cartao" | "pix" | "outro";
export type MovementStatus = "ativo" | "estornado";

// Item de uma venda/comanda (serviço, produto ou avulso). Desnormalizado
// (nome/preço copiados) para o histórico sobreviver a edições no catálogo.
export interface ICashItem {
  kind: "servico" | "produto" | "avulso";
  refId: Types.ObjectId | null; // id do Service/Product quando aplicável
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

// Parcela de pagamento (pagamento dividido). Quando há mais de uma, esta lista
// é a fonte da verdade dos totais por forma; `method`/`amount` guardam o
// principal/total para compatibilidade e telas simples.
export interface ICashPayment {
  method: PaymentMethod;
  amount: number;
}

export interface ICashMovement extends Document {
  session: Types.ObjectId;
  establishment: Types.ObjectId;
  createdBy: Types.ObjectId;
  type: MovementType;
  method: PaymentMethod;
  amount: number;
  description: string;
  booking: Types.ObjectId | null;
  professional: Types.ObjectId | null; // preenchido quando a entrada vem de servico

  // ---- venda/comanda (opcionais; entradas de balcão) ----
  items: Types.DocumentArray<ICashItem>;
  payments: Types.DocumentArray<ICashPayment>;
  discount: number; // desconto aplicado na venda (informativo)
  fee: number; // taxa da maquininha (informativa; não sai da gaveta)

  // cliente da venda (User que agenda; null para avulso/balcão sem cadastro)
  client: Types.ObjectId | null;
  clientName: string; // snapshot do nome (walk-in ou cadastrado)

  // ---- estorno / correção ----
  status: MovementStatus; // "estornado" some dos totais mas fica no histórico
  voidReason: string;
  voidedBy: Types.ObjectId | null;
  voidedAt: Date | null;

  // ---- fiado / a receber ----
  receivable: boolean; // venda a prazo: não conta no caixa até ser paga
  paid: boolean; // recebido?
  paidAt: Date | null;
  dueDate: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const cashItemSchema = new Schema<ICashItem>(
  {
    kind: {
      type: String,
      enum: ["servico", "produto", "avulso"],
      default: "avulso",
    },
    refId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, default: "" },
    qty: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const cashPaymentSchema = new Schema<ICashPayment>(
  {
    method: {
      type: String,
      enum: ["dinheiro", "cartao", "pix", "outro"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const cashMovementSchema = new Schema<ICashMovement>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: "CashSession",
      required: true,
    },
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["entrada", "saida", "sangria", "suprimento"],
      required: true,
    },
    method: {
      type: String,
      enum: ["dinheiro", "cartao", "pix", "outro"],
      default: "dinheiro",
    },
    amount: { type: Number, required: true, min: 0.01 },
    description: { type: String, default: "" },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    // id do profissional (subdoc em Establishment.professionals); so em entradas de servico
    professional: { type: Schema.Types.ObjectId, default: null },

    // venda/comanda
    items: { type: [cashItemSchema], default: [] },
    payments: { type: [cashPaymentSchema], default: [] },
    discount: { type: Number, default: 0, min: 0 },
    fee: { type: Number, default: 0, min: 0 },

    client: { type: Schema.Types.ObjectId, ref: "User", default: null },
    clientName: { type: String, default: "" },

    // estorno
    status: {
      type: String,
      enum: ["ativo", "estornado"],
      default: "ativo",
    },
    voidReason: { type: String, default: "" },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    voidedAt: { type: Date, default: null },

    // fiado / a receber
    receivable: { type: Boolean, default: false },
    paid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

cashMovementSchema.index({ session: 1, createdAt: 1 });
cashMovementSchema.index({ establishment: 1, createdAt: -1 });
// relatórios por período
cashMovementSchema.index({ establishment: 1, type: 1, createdAt: -1 });
// lista de "a receber" (fiado em aberto)
cashMovementSchema.index({ establishment: 1, receivable: 1, paid: 1 });
// evita lancar o mesmo booking duas vezes
cashMovementSchema.index(
  { booking: 1 },
  { unique: true, partialFilterExpression: { booking: { $type: "objectId" } } }
);

export const CashMovement = model<ICashMovement>(
  "CashMovement",
  cashMovementSchema
);
