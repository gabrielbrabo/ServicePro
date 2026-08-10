import { Schema, model, Document, Types } from "mongoose";

// Fila de espera por um servico. O cliente entra quando nao ha vaga no
// dia/periodo desejado. Quando um booking e cancelado e libera horario,
// os interessados sao NOTIFICADOS (waitlist:opening) e quem agir primeiro
// agenda pelo fluxo normal. (Reserva automatica fica para depois.)
//
// targetDate:
// - Date (00:00 local do dia) => espera por AQUELE dia
// - null => espera por QUALQUER vaga do servico
//
// professional:
// - ObjId => espera por AQUELE profissional
// - null  => espera por QUALQUER profissional

export type WaitlistStatus =
  | "aguardando"
  | "notificado"
  | "atendido"
  | "cancelado";

export interface IWaitlist extends Document {
  client: Types.ObjectId;
  establishment: Types.ObjectId;
  owner: Types.ObjectId;
  service: Types.ObjectId;
  professional: Types.ObjectId | null;
  targetDate: Date | null;
  status: WaitlistStatus;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    // null = qualquer profissional
    professional: { type: Schema.Types.ObjectId, default: null },
    targetDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["aguardando", "notificado", "atendido", "cancelado"],
      default: "aguardando",
    },
    notifiedAt: { type: Date },
  },
  { timestamps: true }
);

// ordem de chegada dentro de um servico (FIFO)
waitlistSchema.index({ service: 1, createdAt: 1 });
// consulta rapida por estabelecimento e status
waitlistSchema.index({ establishment: 1, status: 1 });
// evita duplicar entrada para mesmo servico+profissional+dia enquanto aguarda
waitlistSchema.index(
  { client: 1, service: 1, professional: 1, targetDate: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["aguardando", "notificado"] } },
  }
);

export const Waitlist = model<IWaitlist>("Waitlist", waitlistSchema);