import { Schema, model, Document, Types } from "mongoose";

// Bloqueio pontual por DATA ESPECIFICA (diferente de Availability.breaks,
// que sao recorrentes por dia-da-semana).
//
// Usos:
// - bloqueio: compromisso pontual, reuniao, ausencia (intervalo ou dia inteiro)
// - feriado: dia (ou periodo) fechado
// - ferias: periodo de varios dias fechado
//
// professional:
// - null  => bloqueio do estabelecimento inteiro (afeta todos)
// - ObjId => bloqueio daquele profissional especifico
//
// Datas em UTC. allDay=true indica que o intervalo cobre o(s) dia(s) inteiro(s);
// mesmo assim startAt/endAt sao preenchidos (00:00 do primeiro dia -> 00:00 do
// dia seguinte ao ultimo), para que a checagem por sobreposicao funcione igual
// para todos os casos.

export type TimeBlockType = "bloqueio" | "feriado" | "ferias";

export interface ITimeBlock extends Document {
  establishment: Types.ObjectId;
  professional: Types.ObjectId | null;
  createdBy: Types.ObjectId; // quem criou o bloqueio
  type: TimeBlockType;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

const timeBlockSchema = new Schema<ITimeBlock>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    // null = bloqueio do estabelecimento inteiro; senao, do profissional
    professional: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["bloqueio", "feriado", "ferias"],
      default: "bloqueio",
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    label: { type: String, default: "" },
  },
  { timestamps: true }
);

// consultas por estabelecimento + profissional + janela de datas
timeBlockSchema.index({ establishment: 1, professional: 1, startAt: 1, endAt: 1 });

export const TimeBlock = model<ITimeBlock>("TimeBlock", timeBlockSchema);