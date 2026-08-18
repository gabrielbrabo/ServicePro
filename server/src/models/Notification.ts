import { Schema, model, Document, Types } from "mongoose";

export type NotificationType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_completed"
  | "review_request" // convite para o cliente avaliar o atendimento
  | "review_received"; // avisa o estabelecimento que recebeu uma avaliacao

// Notificacao in-app. Uma linha por destinatario: se um agendamento precisa
// avisar dono E funcionario, sao dois documentos.
export interface INotification extends Document {
  user: Types.ObjectId; // destinatario
  type: NotificationType;
  title: string;
  body: string;
  booking: Types.ObjectId | null;
  establishment: Types.ObjectId | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "booking_created",
        "booking_confirmed",
        "booking_cancelled",
        "booking_rescheduled",
        "booking_completed",
        "review_request",
        "review_received",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      default: null,
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// listagem do sininho: nao lidas primeiro, mais recentes no topo
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = model<INotification>(
  "Notification",
  notificationSchema
);