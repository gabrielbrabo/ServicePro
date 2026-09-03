import { Types } from "mongoose";
import { User } from "../models/User";
import { env } from "../config/env";
import { sendWhatsappTemplate, whatsappConfigured } from "./whatsapp";
import { BookingEmailContext } from "./bookingEmails";

// ---------------------------------------------------------------------------
// Disparos de WhatsApp por evento de agendamento (numero unico via Cloud API).
// Irmao do bookingEmails.ts: chamado nos MESMOS pontos do controller/job.
// So envia se o cliente tem telefone e nao deu opt-out (User.whatsappOptIn).
// Fire-and-forget e falha silenciosa.
//
// Templates (aprovados na Meta) recebem 3 variaveis, nesta ordem:
//   {{1}} = nome do estabelecimento
//   {{2}} = servico
//   {{3}} = data/hora (whenLabel)
// ---------------------------------------------------------------------------

const clientPhone = async (
  userId: Types.ObjectId | string
): Promise<string | null> => {
  try {
    const u = await User.findById(userId).select("phone whatsappOptIn");
    if (!u || !u.phone) return null;
    if (u.whatsappOptIn === false) return null; // opt-out explicito
    return u.phone;
  } catch (err) {
    console.error("clientPhone (whatsapp):", err);
    return null;
  }
};

const bodyParams = (ctx: BookingEmailContext): string[] => [
  ctx.establishmentName,
  ctx.serviceTitle,
  ctx.whenLabel,
];

const fire = (
  clientId: Types.ObjectId | string,
  templateName: string,
  ctx: BookingEmailContext
): void => {
  if (!whatsappConfigured() || !templateName) return;
  void clientPhone(clientId).then((phone) => {
    if (phone) void sendWhatsappTemplate(phone, templateName, bodyParams(ctx));
  });
};

export const notifyBookingConfirmedWhatsappAsync = (args: {
  clientId: Types.ObjectId | string;
  ctx: BookingEmailContext;
}): void => fire(args.clientId, env.whatsappTemplates.confirmed, args.ctx);

export const notifyBookingCancelledWhatsappAsync = (args: {
  clientId: Types.ObjectId | string;
  ctx: BookingEmailContext;
}): void => fire(args.clientId, env.whatsappTemplates.cancelled, args.ctx);

export const notifyBookingRescheduledWhatsappAsync = (args: {
  clientId: Types.ObjectId | string;
  ctx: BookingEmailContext;
}): void => fire(args.clientId, env.whatsappTemplates.rescheduled, args.ctx);

export const notifyBookingReminderClientWhatsappAsync = (args: {
  clientId: Types.ObjectId | string;
  ctx: BookingEmailContext;
}): void => fire(args.clientId, env.whatsappTemplates.reminder, args.ctx);

// cliente: convite para avaliar (template dedicado; params: estab, servico, link)
export const notifyReviewRequestWhatsappAsync = (args: {
  clientId: Types.ObjectId | string;
  establishmentName: string;
  serviceTitle: string;
  reviewUrl: string;
}): void => {
  if (!whatsappConfigured() || !env.whatsappTemplates.review) return;
  void clientPhone(args.clientId).then((phone) => {
    if (phone)
      void sendWhatsappTemplate(phone, env.whatsappTemplates.review, [
        args.establishmentName,
        args.serviceTitle,
        args.reviewUrl,
      ]);
  });
};
