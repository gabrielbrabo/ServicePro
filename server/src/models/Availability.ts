import { Schema, model, Document, Types } from "mongoose";

// Disponibilidade recorrente semanal.
// Fase 1: por ESTABELECIMENTO (professional = null).
// Rodada 2: por PROFISSIONAL (professional = _id do subdoc em Establishment).
//
// dayOfWeek: 0 = domingo ... 6 = sabado
// startMinute/endMinute: minutos desde 00:00 (ex: 9h = 540, 18h = 1080)
// Horarios armazenados em UTC; converter para local na exibicao.
//
// professional:
// - null  => agenda GERAL do estabelecimento (comportamento atual)
// - Objid => agenda daquele profissional especifico

export interface IBreak {
  dayOfWeek: number | null; // null = vale para todos os dias
  startMinute: number;
  endMinute: number;
  label?: string;
}

export interface IWorkingHour {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface IAvailability extends Document {
  establishment: Types.ObjectId;
  professional: Types.ObjectId | null;
  workingHours: IWorkingHour[];
  breaks: IBreak[];
  minAdvanceMinutes: number;
  maxFutureDays: number;
}

const workingHourSchema = new Schema<IWorkingHour>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startMinute: { type: Number, required: true, min: 0, max: 1439 },
    endMinute: { type: Number, required: true, min: 1, max: 1440 },
  },
  { _id: false }
);

const breakSchema = new Schema<IBreak>(
  {
    dayOfWeek: { type: Number, default: null, min: 0, max: 6 },
    startMinute: { type: Number, required: true, min: 0, max: 1439 },
    endMinute: { type: Number, required: true, min: 1, max: 1440 },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const availabilitySchema = new Schema<IAvailability>({
  establishment: {
    type: Schema.Types.ObjectId,
    ref: "Establishment",
    required: true,
  },
  // null = agenda geral do estabelecimento; senao, id do profissional
  professional: {
    type: Schema.Types.ObjectId,
    default: null,
  },
  workingHours: { type: [workingHourSchema], default: [] },
  breaks: { type: [breakSchema], default: [] },
  minAdvanceMinutes: { type: Number, default: 30, min: 0 },
  maxFutureDays: { type: Number, default: 30, min: 1 },
});

// uma agenda por (estabelecimento + profissional).
// professional=null conta como um valor: ha no maximo UMA agenda geral.
availabilitySchema.index(
  { establishment: 1, professional: 1 },
  { unique: true }
);

export const Availability = model<IAvailability>(
  "Availability",
  availabilitySchema
);