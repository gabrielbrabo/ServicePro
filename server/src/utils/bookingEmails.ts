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
  reviewRequestClientHtml,
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

// HTML simples e responsivo para o aviso de pagamento pendente
const paymentPendingHtml = (
  ctx: BookingEmailContext,
  amountLabel: string,
  toClient: boolean
): string => {
  const intro = toClient
    ? `Seu atendimento <strong>${ctx.serviceTitle}</strong> em <strong>${ctx.establishmentName}</strong> foi concluído. Falta o pagamento de <strong>${amountLabel}</strong>, que você pode fazer pelo app (PIX ou cartão).`
    : `O atendimento <strong>${ctx.serviceTitle}</strong> foi concluído e está aguardando o pagamento de <strong>${amountLabel}</strong> pelo cliente (pelo app).`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
    <h2 style="color:#0f766e;margin:0 0 12px">Pagamento pendente</h2>
    <p style="font-size:15px;line-height:1.5;margin:0 0 12px">${intro}</p>
    <p style="font-size:13px;color:#6b7280;margin:0">ServiçosPro</p>
  </div>`;
};

// HTML do aviso de pagamento recebido (sinal ou serviço)
const paymentReceivedHtml = (
  ctx: BookingEmailContext,
  amountLabel: string,
  kind: string,
  toClient: boolean
): string => {
  const line = toClient
    ? `Recebemos o pagamento do seu ${kind} (<strong>${amountLabel}</strong>) referente a <strong>${ctx.serviceTitle}</strong> em <strong>${ctx.establishmentName}</strong>. Obrigado!`
    : `O cliente pagou o ${kind} (<strong>${amountLabel}</strong>) de <strong>${ctx.serviceTitle}</strong> pelo app.`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
    <h2 style="color:#0f766e;margin:0 0 12px">Pagamento recebido</h2>
    <p style="font-size:15px;line-height:1.5;margin:0 0 12px">${line}</p>
    <p style="font-size:13px;color:#6b7280;margin:0">ServiçosPro</p>
  </div>`;
};

// pagamento recebido — avisa o cliente
export const notifyPaymentReceivedClientAsync = (args: {
  clientEmail: string | null;
  ctx: BookingEmailContext;
  amountLabel: string;
  kind: string; // "sinal" | "pagamento"
}): void => {
  if (!args.clientEmail) return;
  void sendEmail({
    to: args.clientEmail,
    subject: `Pagamento recebido — ${args.ctx.establishmentName}`,
    html: paymentReceivedHtml(args.ctx, args.amountLabel, args.kind, true),
  });
};

// pagamento recebido — avisa dono + funcionario
export const notifyPaymentReceivedEstablishmentAsync = (args: {
  establishmentEmails: string[];
  ctx: BookingEmailContext;
  amountLabel: string;
  kind: string;
}): void => {
  sendManyAsync(
    args.establishmentEmails,
    `Pagamento recebido — ${args.ctx.serviceTitle}`,
    paymentReceivedHtml(args.ctx, args.amountLabel, args.kind, false)
  );
};

// serviço concluido aguardando pagamento pelo app — avisa o cliente
export const notifyServicePaymentPendingClientAsync = (args: {
  clientEmail: string | null;
  ctx: BookingEmailContext;
  amountLabel: string;
}): void => {
  if (!args.clientEmail) return;
  void sendEmail({
    to: args.clientEmail,
    subject: `Pagamento pendente — ${args.ctx.establishmentName}`,
    html: paymentPendingHtml(args.ctx, args.amountLabel, true),
  });
};

// serviço concluido aguardando pagamento pelo app — avisa dono + funcionario
export const notifyServicePaymentPendingEstablishmentAsync = (args: {
  establishmentEmails: string[];
  ctx: BookingEmailContext;
  amountLabel: string;
}): void => {
  sendManyAsync(
    args.establishmentEmails,
    `Pagamento pendente — ${args.ctx.serviceTitle}`,
    paymentPendingHtml(args.ctx, args.amountLabel, false)
  );
};

// cliente: convite para avaliar o atendimento concluido (link de 1 toque)
export const notifyReviewRequestClientAsync = (args: {
  clientEmail: string | null;
  establishmentName: string;
  serviceTitle: string;
  reviewUrl: string;
}): void => {
  if (!args.clientEmail) return;
  void sendEmail({
    to: args.clientEmail,
    subject: `Como foi seu ${args.serviceTitle}? Avalie o ${args.establishmentName}`,
    html: reviewRequestClientHtml({
      establishmentName: args.establishmentName,
      serviceTitle: args.serviceTitle,
      reviewUrl: args.reviewUrl,
    }),
  });
};
