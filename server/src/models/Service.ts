import { Schema, model, Document, Types } from "mongoose";

// override de duracao por profissional (um sênior pode ser mais rapido que um
// junior no mesmo servico). Se nao houver override, usa durationMinutes.
export interface IProfessionalDuration {
  professional: Types.ObjectId;
  durationMinutes: number;
}

export interface IService extends Document {
  establishment: Types.ObjectId; // estabelecimento dono do servico
  category: Types.ObjectId;
  title: string;
  description: string;
  price: number;
  durationMinutes: number; // duracao TOTAL (inclui a pausa, se houver)
  bufferMinutes: number; // folga de preparo/limpeza APOS o atendimento
  // pausa de processamento: apos `processingGapAfter` min de trabalho ativo,
  // ha `processingGapMinutes` min em que o profissional fica LIVRE (quimica
  // agindo). 0 = sem pausa (bloco contiguo). A pausa esta dentro da duracao.
  processingGapAfter: number;
  processingGapMinutes: number;
  // sinal / pre-pagamento exigido ao agendar. "none" = sem sinal.
  // "percent" = depositValue% do preco; "fixed" = depositValue em R$.
  depositType: "none" | "percent" | "fixed";
  depositValue: number;
  // modalidade: no estabelecimento (local), a domicilio, ou ambos.
  serviceMode: "local" | "domicilio" | "ambos";
  // override da taxa de deslocamento (null = usa o padrao do estabelecimento)
  homeBaseFee: number | null;
  homeFeePerKm: number | null;
  professionalDurations: IProfessionalDuration[]; // overrides por profissional
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
    // folga apos o atendimento (limpeza/preparo). Entra na ocupacao do horario.
    bufferMinutes: { type: Number, default: 0, min: 0 },
    // pausa de processamento (profissional livre no meio do atendimento)
    processingGapAfter: { type: Number, default: 0, min: 0 },
    processingGapMinutes: { type: Number, default: 0, min: 0 },
    // sinal / pre-pagamento exigido ao agendar
    depositType: {
      type: String,
      enum: ["none", "percent", "fixed"],
      default: "none",
    },
    depositValue: { type: Number, default: 0, min: 0 },
    // atendimento a domicilio
    serviceMode: {
      type: String,
      enum: ["local", "domicilio", "ambos"],
      default: "local",
    },
    homeBaseFee: { type: Number, default: null, min: 0 },
    homeFeePerKm: { type: Number, default: null, min: 0 },
    // duracao especifica por profissional (override do durationMinutes)
    professionalDurations: {
      type: [
        new Schema<IProfessionalDuration>(
          {
            professional: { type: Schema.Types.ObjectId, required: true },
            durationMinutes: { type: Number, required: true, min: 1 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
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

// duracao efetiva de um servico para um profissional: usa o override daquele
// profissional se existir; senao, a duracao padrao do servico.
export function effectiveDuration(
  service: {
    durationMinutes: number;
    professionalDurations?: { professional: Types.ObjectId; durationMinutes: number }[];
  },
  professionalId?: Types.ObjectId | string | null
): number {
  if (professionalId && service.professionalDurations) {
    const o = service.professionalDurations.find(
      (d) => String(d.professional) === String(professionalId)
    );
    if (o && o.durationMinutes > 0) return o.durationMinutes;
  }
  return service.durationMinutes;
}

// valor do sinal exigido por um servico (R$, 2 casas). 0 = sem sinal.
export function depositFor(service: {
  price: number;
  depositType?: "none" | "percent" | "fixed";
  depositValue?: number;
}): number {
  const type = service.depositType || "none";
  const value = service.depositValue || 0;
  if (type === "none" || value <= 0) return 0;
  const raw = type === "percent" ? (service.price * value) / 100 : value;
  // nunca exige mais que o preco do servico
  return Math.round(Math.min(raw, service.price) * 100) / 100;
}