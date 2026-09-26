import { Schema, model, Document, Types } from "mongoose";

// Registro de UMA comissao confirmada do afiliado/representante. O dinheiro em
// si e repassado pelo split do Asaas; este ledger existe para o painel mostrar
// o que foi efetivamente RECEBIDO (nao so o previsto) e dar historico.
// Idempotente por paymentId: o mesmo pagamento nunca vira duas comissoes.
export type CommissionType = "paid" | "renewed";
// como o dinheiro chega ao afiliado:
//  "split"        = o Asaas ja repassou no pagamento (split). Padrao/antigos.
//  "pending"      = pagamento entrou SEM split (subconta ainda nao aprovada /
//                   split recusado): fica "a repassar" para o afiliado.
//  "transferring" = transferencia em andamento (trava contra repasse em dobro)
//  "transferred"  = repassado por transferencia para a carteira do afiliado
export type CommissionPayout = "split" | "pending" | "transferring" | "transferred";

export interface IAffiliateCommission extends Document {
  _id: Types.ObjectId;
  affiliate: Types.ObjectId;
  subscription: Types.ObjectId;
  establishment: Types.ObjectId | null;
  // id do pagamento no gateway (unico) — garante idempotencia
  paymentId: string;
  grossCents: number; // valor pago pelo indicado (base da comissao)
  commissionPercent: number;
  commissionCents: number; // valor da comissao (grossCents * percent / 100)
  type: CommissionType; // "paid" = 1a cobranca; "renewed" = renovacao
  paidAt: Date;
  // estorno/chargeback: quando o indicado estorna, o Asaas reverte o split.
  // Marcamos a comissao como revertida para nao inflar o "recebido".
  reversed: boolean;
  reversedAt: Date | null;
  payout: CommissionPayout;
  transferId: string;
  transferredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const affiliateCommissionSchema = new Schema<IAffiliateCommission>(
  {
    affiliate: {
      type: Schema.Types.ObjectId,
      ref: "Affiliate",
      required: true,
      index: true,
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
      index: true,
    },
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      default: null,
    },
    paymentId: { type: String, required: true, unique: true },
    grossCents: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionCents: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ["paid", "renewed"],
      default: "paid",
    },
    paidAt: { type: Date, default: Date.now },
    // estorno/chargeback
    reversed: { type: Boolean, default: false, index: true },
    reversedAt: { type: Date, default: null },
    // repasse (ver CommissionPayout)
    payout: {
      type: String,
      enum: ["split", "pending", "transferring", "transferred"],
      default: "split",
      index: true,
    },
    transferId: { type: String, default: "" },
    transferredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const AffiliateCommission = model<IAffiliateCommission>(
  "AffiliateCommission",
  affiliateCommissionSchema
);
