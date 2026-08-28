import { Schema, model, Document, Types } from "mongoose";

// Ordem de Servico (OS) — o "prontuario" dos servicos gerais (assistencia
// tecnica, eletricista, encanador, refrigeracao, oficina, reparos, etc.).
// E do ESTABELECIMENTO: cada documento e uma OS com defeito relatado,
// diagnostico, pecas/materiais, mao de obra, status, garantia e fotos.

export type ServiceOrderStatus =
  | "orcamento"
  | "aprovado"
  | "em_execucao"
  | "concluido"
  | "entregue"
  | "cancelado";

export interface IServiceOrderPart {
  description: string;
  qty: number;
  unitPrice: number;
}

export type InspectionStatus = "ok" | "atencao" | "troca" | "na";
export interface IInspectionItem {
  item: string;
  status: InspectionStatus;
  note: string;
}
// dados do veiculo (extra da categoria automotiva)
export interface IVehicle {
  plate: string;
  brand: string;
  model: string;
  year: number;
  km: number;
  color: string;
}
// dados do equipamento (extra da categoria assistencia tecnica)
export interface IEquipment {
  brand: string;
  model: string;
  serial: string; // numero de serie
  accessories: string; // o que acompanha (carregador, cabo...)
  condition: string; // estado na entrada (riscos, etc.)
}

export interface IServiceOrder extends Document {
  establishment: Types.ObjectId;
  number: number; // sequencial por estabelecimento (OS #)
  clientName: string;
  clientPhone: string;
  client: Types.ObjectId | null; // cliente registrado (opcional)
  professional: Types.ObjectId | null; // responsavel (subdoc do estab.)
  title: string; // assunto ("Conserto de geladeira Brastemp")
  object: string; // equipamento/veiculo/local (descricao livre)
  reportedProblem: string; // defeito relatado pelo cliente
  diagnosis: string; // diagnostico tecnico
  parts: Types.DocumentArray<IServiceOrderPart & Document>; // pecas/materiais
  laborCost: number; // mao de obra
  discount: number;
  total: number; // pecas + mao de obra - desconto (calculado)
  status: ServiceOrderStatus;
  warrantyDays: number; // garantia (dias)
  warrantyNote: string;
  photosBefore: string[];
  photosAfter: string[];
  notes: string;
  vehicle: IVehicle; // extra automotivo
  inspection: Types.DocumentArray<IInspectionItem & Document>; // checklist
  equipment: IEquipment; // extra assistencia tecnica
  technicalReport: string; // laudo tecnico
  // extra dedetizacao (certificado)
  pestControl: {
    targetPest: string; // praga-alvo
    products: string; // produtos + principio ativo
    method: string; // metodo (pulverizacao, gel, iscas)
    nextApplication: string; // proxima aplicacao / validade (texto/data)
    technician: string; // responsavel tecnico + registro
  };
  paymentMethod: "dinheiro" | "cartao" | "pix" | "outro"; // forma de pagamento
  postedToCash: boolean; // ja lancado no caixa (ao ser "entregue")
  author: Types.ObjectId; // quem registrou
  createdAt: Date;
  updatedAt: Date;
}

const partSchema = new Schema<IServiceOrderPart>(
  {
    description: { type: String, default: "", trim: true },
    qty: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const inspectionSchema = new Schema<IInspectionItem>(
  {
    item: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["ok", "atencao", "troca", "na"],
      default: "na",
    },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const serviceOrderSchema = new Schema<IServiceOrder>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    number: { type: Number, default: 0 },
    clientName: { type: String, default: "", trim: true },
    clientPhone: { type: String, default: "", trim: true },
    client: { type: Schema.Types.ObjectId, ref: "User", default: null },
    professional: { type: Schema.Types.ObjectId, default: null },
    title: { type: String, default: "", trim: true },
    object: { type: String, default: "", trim: true },
    reportedProblem: { type: String, default: "", trim: true },
    diagnosis: { type: String, default: "", trim: true },
    parts: { type: [partSchema], default: [] },
    laborCost: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: [
        "orcamento",
        "aprovado",
        "em_execucao",
        "concluido",
        "entregue",
        "cancelado",
      ],
      default: "orcamento",
    },
    warrantyDays: { type: Number, default: 0, min: 0 },
    warrantyNote: { type: String, default: "", trim: true },
    photosBefore: { type: [String], default: [] },
    photosAfter: { type: [String], default: [] },
    notes: { type: String, default: "", trim: true },
    // extra automotivo (categoria com modulo "veiculo")
    vehicle: {
      plate: { type: String, default: "", trim: true },
      brand: { type: String, default: "", trim: true },
      model: { type: String, default: "", trim: true },
      year: { type: Number, default: 0 },
      km: { type: Number, default: 0 },
      color: { type: String, default: "", trim: true },
    },
    inspection: { type: [inspectionSchema], default: [] },
    // extra assistencia tecnica (categoria com modulo "equipamento")
    equipment: {
      brand: { type: String, default: "", trim: true },
      model: { type: String, default: "", trim: true },
      serial: { type: String, default: "", trim: true },
      accessories: { type: String, default: "", trim: true },
      condition: { type: String, default: "", trim: true },
    },
    technicalReport: { type: String, default: "", trim: true },
    // extra dedetizacao (certificado)
    pestControl: {
      targetPest: { type: String, default: "", trim: true },
      products: { type: String, default: "", trim: true },
      method: { type: String, default: "", trim: true },
      nextApplication: { type: String, default: "", trim: true },
      technician: { type: String, default: "", trim: true },
    },
    paymentMethod: {
      type: String,
      enum: ["dinheiro", "cartao", "pix", "outro"],
      default: "dinheiro",
    },
    postedToCash: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

serviceOrderSchema.index({ establishment: 1, number: -1 });
serviceOrderSchema.index({ establishment: 1, status: 1, createdAt: -1 });

// soma pecas + mao de obra - desconto (nunca negativo)
export function computeOrderTotal(o: {
  parts?: { qty: number; unitPrice: number }[];
  laborCost?: number;
  discount?: number;
}): number {
  const partsTotal = (o.parts || []).reduce(
    (sum, p) => sum + (Number(p.qty) || 0) * (Number(p.unitPrice) || 0),
    0
  );
  const total = partsTotal + (Number(o.laborCost) || 0) - (Number(o.discount) || 0);
  return Math.round(Math.max(0, total) * 100) / 100;
}

export const ServiceOrder = model<IServiceOrder>(
  "ServiceOrder",
  serviceOrderSchema
);
