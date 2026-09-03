import { Schema, model, Document, Types } from "mongoose";

// Plano de manutencao recorrente (extra da categoria jardinagem-paisagismo,
// modulo "manutencao"). E do ESTABELECIMENTO: cada documento e um contrato de
// manutencao de um cliente/local, com frequencia e escopo de servicos. Pode
// GERAR VISITAS na agenda (bookings recorrentes confirmados, agrupados por
// seriesId) — igual as matriculas, mas com intervalo pela frequencia.

export type MaintenanceFrequency =
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "personalizada";

export interface IMaintenanceTask {
  name: string; // servico recorrente (ex: "Cortar grama")
}

export interface IMaintenancePlan extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId | null; // cliente cadastrado (necessario p/ agendar)
  clientName: string; // snapshot do nome (exibicao)
  clientPhone: string;
  location: string; // endereco / local do servico
  frequency: MaintenanceFrequency;
  frequencyNote: string; // detalhe (ex: "toda 2a e 5a") quando personalizada
  active: boolean; // contrato ativo ou pausado
  // agendamento das visitas na agenda
  service: Types.ObjectId | null; // servico usado nas visitas
  professional: Types.ObjectId | null;
  startDate: string; // 1a visita: data "YYYY-MM-DD"
  time: string; // horario "HH:mm"
  visitsCount: number; // quantas visitas gerar de uma vez
  seriesId: Types.ObjectId | null; // serie de bookings gerada (null = nao agendado)
  tasks: Types.DocumentArray<IMaintenanceTask & Document>; // escopo do plano
  notes: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<IMaintenanceTask>(
  { name: { type: String, default: "", trim: true } },
  { _id: false }
);

const FREQUENCIES = [
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "personalizada",
];

const maintenancePlanSchema = new Schema<IMaintenancePlan>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", default: null },
    clientName: { type: String, default: "", trim: true },
    clientPhone: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    frequency: { type: String, enum: FREQUENCIES, default: "mensal" },
    frequencyNote: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    professional: { type: Schema.Types.ObjectId, default: null },
    startDate: { type: String, default: "", trim: true },
    time: { type: String, default: "", trim: true },
    visitsCount: { type: Number, default: 4, min: 1, max: 53 },
    seriesId: { type: Schema.Types.ObjectId, default: null },
    tasks: { type: [taskSchema], default: [] },
    notes: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

maintenancePlanSchema.index({ establishment: 1, active: -1, updatedAt: -1 });

export const MaintenancePlan = model<IMaintenancePlan>(
  "MaintenancePlan",
  maintenancePlanSchema
);
