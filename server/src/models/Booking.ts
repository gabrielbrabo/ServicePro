import { Schema, model, Document, Types } from "mongoose";

export type BookingStatus =
  | "pendente"
  | "confirmado"
  | "concluido"
  | "cancelado"
  | "reservado";

export type PaymentStatus = "pendente" | "pago" | "reembolsado" | "falhou";
export type PaymentMethod = "dinheiro" | "cartao" | "pix" | "outro" | "";

export interface IRescheduleEntry {
  previousScheduledAt: Date;
  previousEndsAt: Date;
  rescheduledBy: Types.ObjectId;
  rescheduledByRole: "cliente" | "dono" | "profissional";
  at: Date;
}

export interface IBooking extends Document {
  client: Types.ObjectId;
  establishment: Types.ObjectId;
  owner: Types.ObjectId;
  service: Types.ObjectId;
  professional: Types.ObjectId | null;
  seriesId: Types.ObjectId | null; // agrupa bookings de uma serie recorrente
  reservationExpiresAt?: Date; // prazo para o cliente confirmar (status reservado)
  fromWaitlist: Types.ObjectId | null; // entrada da fila que gerou esta reserva
  scheduledAt: Date;
  endsAt: Date;
  status: BookingStatus;
  notes?: string;
  address?: string;
  completedAt?: Date;
  // avaliacao (sistema de estrelas): marca que o cliente ja foi convidado/
  // avaliou este atendimento, para nao pedir avaliacao mais de uma vez.
  reviewed?: boolean;
  // lembretes agendados (Etapa C)
  // antecedencia escolhida pelo cliente ao agendar, em minutos; null = sem lembrete
  clientReminderMinutes?: number | null;
  clientReminderSentAt?: Date; // marca quando o lembrete do cliente ja foi enviado
  // antecedencia (min) do lembrete do estabelecimento, escolhida por quem
  // CONFIRMA o agendamento; null ate confirmar
  ownerReminderMinutes?: number | null;
  ownerReminderSentAt?: Date; // marca quando o lembrete do estabelecimento ja foi enviado
  // badge do cliente: marca quando o estabelecimento agiu e quando o cliente viu
  clientNotifiedAt?: Date;
  clientSeenAt?: Date;
  rescheduleHistory: IRescheduleEntry[];
  payment: {
    status: PaymentStatus;
    method: PaymentMethod; // forma informada ao concluir; "" ate concluir
    amount: number;
    provider?: string;
    transactionId?: string;
    postedToCash: boolean; // ja virou entrada no caixa?
  };
  createdAt: Date;
  updatedAt: Date;
}

const rescheduleEntrySchema = new Schema<IRescheduleEntry>(
  {
    previousScheduledAt: { type: Date, required: true },
    previousEndsAt: { type: Date, required: true },
    rescheduledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rescheduledByRole: {
      type: String,
      enum: ["cliente", "dono", "profissional"],
      required: true,
    },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new Schema<IBooking>(
  {
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    professional: { type: Schema.Types.ObjectId, default: null },
    // agrupa bookings criados juntos numa serie recorrente; null = avulso
    seriesId: { type: Schema.Types.ObjectId, default: null },
    // prazo para o cliente confirmar uma reserva automatica (status "reservado")
    reservationExpiresAt: { type: Date },
    // entrada da lista de espera que originou esta reserva
    fromWaitlist: {
      type: Schema.Types.ObjectId,
      ref: "Waitlist",
      default: null,
    },
    scheduledAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pendente", "confirmado", "concluido", "cancelado", "reservado"],
      default: "pendente",
    },
    notes: { type: String },
    address: { type: String },
    completedAt: { type: Date },
    // avaliacao: cliente ja convidado/avaliou este atendimento
    reviewed: { type: Boolean, default: false },
    // lembretes agendados (Etapa C)
    clientReminderMinutes: { type: Number, default: null },
    clientReminderSentAt: { type: Date },
    ownerReminderMinutes: { type: Number, default: null },
    ownerReminderSentAt: { type: Date },
    clientNotifiedAt: { type: Date },
    clientSeenAt: { type: Date },
    rescheduleHistory: { type: [rescheduleEntrySchema], default: [] },
    payment: {
      status: {
        type: String,
        enum: ["pendente", "pago", "reembolsado", "falhou"],
        default: "pendente",
      },
      method: {
        type: String,
        enum: ["dinheiro", "cartao", "pix", "outro", ""],
        default: "",
      },
      amount: { type: Number, required: true, min: 0 },
      provider: { type: String },
      transactionId: { type: String },
      postedToCash: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ establishment: 1, scheduledAt: 1 });
bookingSchema.index({ client: 1, createdAt: -1 });
bookingSchema.index({ professional: 1, scheduledAt: 1 });
// busca de pendentes de caixa na abertura (concluidos, nao lancados)
bookingSchema.index({ establishment: 1, status: 1, "payment.postedToCash": 1 });
bookingSchema.index({ seriesId: 1 });
bookingSchema.index({ status: 1, reservationExpiresAt: 1 });
// busca do cron de lembretes: confirmados por horario
bookingSchema.index({ status: 1, scheduledAt: 1 });

export const Booking = model<IBooking>("Booking", bookingSchema);