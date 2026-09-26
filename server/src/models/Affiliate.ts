import { Schema, model, Document, Types } from "mongoose";

// Conta de afiliado/representante do ServiçosPro. Uma por usuario (o afiliado
// reaproveita a conta User para login). Recebe comissao das assinaturas dos
// seus indicados via split do Asaas, direto numa SUBCONTA propria (asaasWalletId),
// de onde ele saca dentro do Asaas.
export type AffiliateStatus = "active" | "suspended";
// "upfront"  = modelo antigo: subconta Asaas aberta NO CADASTRO (paga na hora).
// "deferred" = subconta aberta so quando o 1o indicado ASSINA (afiliado que
//              nao traz ninguem nao gera custo de abertura de conta).
export type AffiliateAccountMode = "upfront" | "deferred";

export interface IAffiliate extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  // codigo publico do link de indicacao (?ref=<code>)
  code: string;
  status: AffiliateStatus;
  // porcentagem da comissao (o preco dos planos ja embute os 25%)
  commissionPercent: number;
  // subconta Asaas do afiliado (recebe o split). apiKey so vem UMA vez na
  // criacao — guardamos para consultar saldo/saque na subconta depois.
  asaasAccountId: string;
  asaasWalletId: string;
  asaasApiKey: string;
  // conta Asaas aprovada (KYC/documentos)? So libera o link e o split depois.
  approved: boolean;
  approvedAt: Date | null;
  accountMode: AffiliateAccountMode;
  // quando a subconta foi aberta (deferred) + trava contra abertura em dobro
  accountOpenedAt: Date | null;
  accountOpeningAt: Date | null;
  accountOpenError: string;
  // dados de KYC exigidos pelo Asaas para abrir a subconta
  cpfCnpj: string;
  phone: string;
  birthDate: string; // YYYY-MM-DD (pessoa fisica)
  postalCode: string; // CEP
  address: string;
  addressNumber: string;
  province: string; // bairro
  createdAt: Date;
  updatedAt: Date;
}

const affiliateSchema = new Schema<IAffiliate>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // uma conta de afiliado por usuario
    },
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    commissionPercent: { type: Number, default: 25, min: 0, max: 100 },
    // subconta Asaas (recebimento via split)
    asaasAccountId: { type: String, default: "", index: true },
    asaasWalletId: { type: String, default: "", index: true },
    asaasApiKey: { type: String, default: "", select: false },
    // aprovacao da conta Asaas (KYC). So libera link/split apos aprovada.
    approved: { type: Boolean, default: false, index: true },
    approvedAt: { type: Date, default: null },
    // docs antigos (sem o campo) = "upfront" (ja tem subconta)
    accountMode: {
      type: String,
      enum: ["upfront", "deferred"],
      default: "upfront",
    },
    accountOpenedAt: { type: Date, default: null },
    accountOpeningAt: { type: Date, default: null },
    accountOpenError: { type: String, default: "" },
    // KYC (nao expor por padrao)
    cpfCnpj: { type: String, default: "", select: false },
    phone: { type: String, default: "" },
    birthDate: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    address: { type: String, default: "" },
    addressNumber: { type: String, default: "" },
    province: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Affiliate = model<IAffiliate>("Affiliate", affiliateSchema);
