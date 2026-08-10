import { Booking } from "../models/Booking";
import { Service } from "../models/Service";
import { Establishment } from "../models/Establishment";
import { notifyManyAsync } from "./notify";
import {
  establishmentEmailRecipients,
  userEmail,
  formatWhen,
  notifyBookingReminderClientAsync,
  notifyBookingReminderEstablishmentAsync,
} from "./bookingEmails";
import { establishmentRecipients } from "./notify";

// ---------------------------------------------------------------------------
// Lembretes agendados (Etapa C).
//
// Irmao do expireReservations (utils/autoReserve.ts): roda periodicamente pelo
// job, busca agendamentos CONFIRMADOS cujo horario de lembrete ja chegou e que
// ainda nao foram lembrados, e dispara e-mail + notificacao in-app.
//
// Dois lembretes INDEPENDENTES por agendamento:
//  - cliente: antecedencia escolhida no ato do agendamento (clientReminderMinutes)
//  - estabelecimento (dono + funcionario): antecedencia do Establishment
//    (ownerReminderMinutes, default 30)
// Cada um tem seu proprio carimbo (clientReminderSentAt / ownerReminderSentAt)
// para nao reenviar a cada passada do cron.
//
// Falha de um agendamento nunca derruba o lote: cada item e tratado em try/catch.
// ---------------------------------------------------------------------------

// janela de busca do cron: agora + esta antecedencia maxima. Cobre tanto o
// maior lembrete de cliente (180 min) quanto um ownerReminderMinutes grande
// que o dono venha a configurar (ex: 1 dia). Evita varrer a tabela inteira.
const MAX_LOOKAHEAD_MINUTES = 1440;

export const sendDueReminders = async (): Promise<number> => {
  const now = new Date();

  // limite superior da busca: agora + (maior antecedencia de cliente). Qualquer
  // agendamento cujo lembrete precise sair agora tem scheduledAt <= este limite.
  const upperBound = new Date(now.getTime() + MAX_LOOKAHEAD_MINUTES * 60000);

  // candidatos: confirmados, futuros, dentro da janela, com pelo menos um dos
  // dois lembretes ainda pendente.
  const candidates = await Booking.find({
    status: "confirmado",
    scheduledAt: { $gt: now, $lte: upperBound },
    $or: [
      { clientReminderSentAt: { $exists: false } },
      { ownerReminderSentAt: { $exists: false } },
    ],
  });

  let sent = 0;

  for (const b of candidates) {
    try {
      const msUntilStart = b.scheduledAt.getTime() - now.getTime();
      const minutesUntilStart = msUntilStart / 60000;

      // contexto comum dos e-mails/notificacoes (busca preguicosa, so se precisar)
      let serviceTitle: string | null = null;
      let establishmentName: string | null = null;

      const ensureCtx = async () => {
        if (serviceTitle !== null) return; // ja carregado
        const [svc, est] = await Promise.all([
          Service.findById(b.service).select("title"),
          Establishment.findById(b.establishment).select("name"),
        ]);
        serviceTitle = svc?.title || "Agendamento";
        establishmentName = est?.name || "";
      };

      const whenLabel = formatWhen(b.scheduledAt);

      // ---- lembrete do CLIENTE ----
      // dispara se o cliente pediu lembrete, ainda nao recebeu, e ja entramos
      // na janela (faltam <= a antecedencia escolhida para o horario).
      if (
        b.clientReminderMinutes &&
        !b.clientReminderSentAt &&
        minutesUntilStart <= b.clientReminderMinutes
      ) {
        await ensureCtx();
        const ctx = {
          serviceTitle: serviceTitle!,
          establishmentName: establishmentName!,
          whenLabel,
        };

        // notificacao in-app
        notifyManyAsync([b.client], {
          type: "booking_confirmed", // reaproveita tipo existente (lembrete)
          title: "Lembrete de agendamento",
          body: `${serviceTitle} em ${whenLabel}`,
          booking: b._id,
          establishment: b.establishment,
        });

        // e-mail
        const clientMail = await userEmail(b.client);
        notifyBookingReminderClientAsync({ clientEmail: clientMail, ctx });

        b.clientReminderSentAt = now;
        sent++;
      }

      // ---- lembrete do ESTABELECIMENTO (dono + funcionario) ----
      // antecedencia escolhida por quem confirmou (gravada no booking); se por
      // algum motivo nao houver (booking confirmado antes desta feature), 30.
      const ownerMinutes =
        typeof b.ownerReminderMinutes === "number"
          ? b.ownerReminderMinutes
          : 30;
      if (!b.ownerReminderSentAt) {
        await ensureCtx();
        if (minutesUntilStart <= ownerMinutes) {
          const ctx = {
            serviceTitle: serviceTitle!,
            establishmentName: establishmentName!,
            whenLabel,
          };

          // notificacao in-app para dono + funcionario vinculado
          const recipients = await establishmentRecipients(
            b.establishment,
            b.professional
          );
          notifyManyAsync(recipients, {
            type: "booking_confirmed", // reaproveita tipo existente (lembrete)
            title: "Lembrete de agendamento",
            body: `${serviceTitle} em ${whenLabel}`,
            booking: b._id,
            establishment: b.establishment,
          });

          // e-mail para dono + funcionario
          const estMails = await establishmentEmailRecipients(
            b.establishment,
            b.professional
          );
          notifyBookingReminderEstablishmentAsync({
            establishmentEmails: estMails,
            ctx,
          });

          b.ownerReminderSentAt = now;
          sent++;
        }
      }

      // grava os carimbos so se algo mudou
      if (b.isModified()) {
        await b.save();
      }
    } catch (err) {
      console.error("sendDueReminders (item):", err);
    }
  }

  return sent;
};