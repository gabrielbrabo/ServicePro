import { Types } from "mongoose";
import { Establishment } from "../models/Establishment";
import { User } from "../models/User";
import {
  sendEmail,
  bookingCreatedEstablishmentHtml,
  bookingConfirmedClientHtml,
  bookingCancelledClientHtml,
  bookingRescheduledClientHtml,
  bookingRescheduledEstablishmentHtml,
  bookingReminderClientHtml,
  bookingReminderEstablishmentHtml,
} from "../config/email";

// ---------------------------------------------------------------------------
// Helper de e-mails de agendamento (Etapa B).
//
// Irmao do utils/notify.ts, mas com uma diferenca importante: notify trabalha
// com IDS de usuario (grava notificacao/socket por id); aqui precisamos dos
// ENDERECOS DE E-MAIL. Por isso este helper faz o de-para id -> email.
//
// Assim como notify, TUDO aqui e fire-and-forget e falha silenciosa: um e-mail
// que nao sai jamais pode derrubar a resposta HTTP do agendamento.
// ---------------------------------------------------------------------------

// dados minimos que os templates precisam
export interface BookingEmailContext {
  serviceTitle: string;
  establishmentName: string;
  whenLabel: string; // data/hora ja formatada em pt-BR
  professionalName?: string | null;
}

// formata a data/hora de um booking no padrao pt-BR usado nas notificacoes
export const formatWhen = (date: Date): string =>
  date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Descobre os ENDERECOS de e-mail do lado do estabelecimento: o dono e, se o
// agendamento tem profissional vinculado a um login, tambem o funcionario.
// Espelha establishmentRecipients do notify.ts, mas devolve e-mails.
export const establishmentEmailRecipients = async (
  establishmentId: Types.ObjectId | string,
  professionalId?: Types.ObjectId | null
): Promise<string[]> => {
  try {
    const est = await Establishment.findById(establishmentId).select(
      "owner professionals"
    );
    if (!est) return [];

    const userIds = new Set<string>();
    userIds.add(est.owner.toString());

    if (professionalId) {
      const prof = est.professionals.id(professionalId);
      if (prof?.linkedUser) {
        userIds.add(prof.linkedUser.toString());
      }
    }

    const users = await User.find({
      _id: { $in: Array.from(userIds).map((id) => new Types.ObjectId(id)) },
    }).select("email");

    // dedup por email (dono e funcionario podem, em tese, compartilhar email)
    const emails = new Set<string>();
    for (const u of users) {
      if (u.email) emails.add(u.email);
    }
    return Array.from(emails);
  } catch (err) {
    console.error("establishmentEmailRecipients:", err);
    return [];
  }
};

// busca o email de um unico usuario (ex: o cliente do agendamento)
export const userEmail = async (
  userId: Types.ObjectId | string
): Promise<string | null> => {
  try {
    const u = await User.findById(userId).select("email");
    return u?.email || null;
  } catch (err) {
    console.error("userEmail:", err);
    return null;
  }
};

// dispara varios e-mails sem bloquear; erros ja sao engolidos no sendEmail
const sendManyAsync = (
  recipients: string[],
  subject: string,
  html: string
): void => {
  const unique = Array.from(new Set(recipients.filter(Boolean)));
  for (const to of unique) {
    void sendEmail({ to, subject, html });
  }
};

// ---------------------------------------------------------------------------
// Envios por evento. Todos fire-and-forget (retornam void, nao sao aguardados).
// ---------------------------------------------------------------------------

// Novo agendamento: apenas dono + funcionario recebem aviso por e-mail.
// O cliente NAO recebe e-mail ao agendar — so quando o estabelecimento
// confirmar (ver notifyBookingConfirmedAsync).
export const notifyBookingCreatedAsync = (args: {
  establishmentEmails: string[];
  ctx: BookingEmailContext;
}): void => {
  const { establishmentEmails, ctx } = args;

  sendManyAsync(
    establishmentEmails,
    `Novo agendamento — ${ctx.serviceTitle}`,
    bookingCreatedEstablishmentHtml(ctx)
  );
};

// Estabelecimento confirmou: avisa o cliente.
export const notifyBookingConfirmedAsync = (args: {
  clientEmail: string | null;
  ctx: BookingEmailContext;
}): void => {
  if (!args.clientEmail) return;
  void sendEmail({
    to: args.clientEmail,
    subject: `Agendamento confirmado — ${args.ctx.establishmentName}`,
    html: bookingConfirmedClientHtml(args.ctx),
  });
};

// Estabelecimento cancelou: avisa o cliente.
export const notifyBookingCancelledClientAsync = (args: {
  clientEmail: string | null;
  ctx: BookingEmailContext;
}): void => {
  if (!args.clientEmail) return;
  void sendEmail({
    to: args.clientEmail,
    subject: `Agendamento cancelado — ${args.ctx.establishmentName}`,
    html: bookingCancelledClientHtml(args.ctx),
  });
};

// Estabelecimento reagendou: avisa o cliente.
export const notifyBookingRescheduledClientAsync = (args: {
  clientEmail: string | null;
  ctx: BookingEmailContext;
}): void => {
  if (!args.clientEmail) return;
  void sendEmail({
    to: args.clientEmail,
    subject: `Agendamento remarcado — ${args.ctx.establishmentName}`,
    html: bookingRescheduledClientHtml(args.ctx),
  });
};

// Cliente reagendou: avisa dono + funcionario.
export const notifyBookingRescheduledEstablishmentAsync = (args: {
  establishmentEmails: string[];
  ctx: BookingEmailContext;
}): void => {
  sendManyAsync(
    args.establishmentEmails,
    `Agendamento remarcado pelo cliente — ${args.ctx.serviceTitle}`,
    bookingRescheduledEstablishmentHtml(args.ctx)
  );
};

// Lembrete de agendamento proximo — cliente.
export const notifyBookingReminderClientAsync = (args: {
  clientEmail: string | null;
  ctx: BookingEmailContext;
}): void => {
  if (!args.clientEmail) return;
  void sendEmail({
    to: args.clientEmail,
    subject: `Lembrete — ${args.ctx.serviceTitle} em ${args.ctx.establishmentName}`,
    html: bookingReminderClientHtml(args.ctx),
  });
};

// Lembrete de agendamento proximo — dono + funcionario.
export const notifyBookingReminderEstablishmentAsync = (args: {
  establishmentEmails: string[];
  ctx: BookingEmailContext;
}): void => {
  sendManyAsync(
    args.establishmentEmails,
    `Lembrete — ${args.ctx.serviceTitle} às ${args.ctx.whenLabel}`,
    bookingReminderEstablishmentHtml(args.ctx)
  );
};