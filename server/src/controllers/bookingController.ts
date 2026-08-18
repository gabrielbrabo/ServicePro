import { Response } from "express";
import { Booking } from "../models/Booking";
import { Service } from "../models/Service";
import { Establishment } from "../models/Establishment";
import { Review } from "../models/Review";
import { CashSession } from "../models/CashSession";
import { AuthRequest } from "../middleware/auth";
import { getIO } from "../socket";
import { assertSlotIsBookable } from "../utils/slotValidation";
import { notifyWaitlistOpening } from "../utils/waitlistNotify";
import { professionalDoesService } from "../utils/serviceProfessional";
import { postBookingToCash } from "../utils/cashPosting";
import { autoReserveSlot } from "../utils/autoReserve";
import { notifyManyAsync, establishmentRecipients } from "../utils/notify";
import {
  establishmentEmailRecipients,
  userEmail,
  formatWhen,
  notifyBookingCreatedAsync,
  notifyBookingConfirmedAsync,
  notifyBookingCancelledClientAsync,
  notifyBookingRescheduledClientAsync,
  notifyBookingRescheduledEstablishmentAsync,
} from "../utils/bookingEmails";
import { Types } from "mongoose";

// busca o nome do profissional (subdoc) de um estabelecimento, se houver.
// Usado apenas para enriquecer os e-mails; falha silenciosa -> null.
const professionalNameOf = async (
  establishmentId: Types.ObjectId | string,
  professionalId?: Types.ObjectId | null
): Promise<string | null> => {
  if (!professionalId) return null;
  try {
    const est = await Establishment.findById(establishmentId).select(
      "professionals"
    );
    const prof = est?.professionals.id(professionalId);
    return prof?.name || null;
  } catch {
    return null;
  }
};

const parseProfessional = (value: unknown): Types.ObjectId | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

const VALID_METHODS = ["dinheiro", "cartao", "pix", "outro"];

// status que OCUPAM um horario (usado em todas as checagens de conflito)
const BUSY_STATUSES = ["pendente", "confirmado", "reservado"];

// POST /api/bookings  (protegido)
export const createBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { serviceId, scheduledAt, notes, address, professionalId } = req.body;

    // antecedencia do lembrete escolhida pelo cliente (min). Aceita apenas
    // valores previstos; qualquer outra coisa cai no padrao de 1 hora.
    const ALLOWED_REMINDERS = [15, 30, 45, 60, 120, 180];
    const rawReminder = Number(req.body.clientReminderMinutes);
    const clientReminderMinutes = ALLOWED_REMINDERS.includes(rawReminder)
      ? rawReminder
      : 60;

    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }

    const establishment = await Establishment.findById(service.establishment);
    if (!establishment) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    const prof = parseProfessional(professionalId);
    const activePros = establishment.professionals.filter((p) => p.active);

    if (activePros.length > 0 && !prof) {
      res
        .status(400)
        .json({ message: "Escolha um profissional para este agendamento" });
      return;
    }

    if (prof) {
      const exists = activePros.some((p) => p._id.toString() === prof.toString());
      if (!exists) {
        res
          .status(404)
          .json({ message: "Profissional nao encontrado ou inativo" });
        return;
      }
    }

    if (!professionalDoesService(service.professionals, prof)) {
      res
        .status(400)
        .json({ message: "Este profissional nao realiza o servico escolhido" });
      return;
    }

    const start = new Date(scheduledAt);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "Data/hora invalida" });
      return;
    }
    const end = new Date(start);
    end.setUTCMinutes(end.getUTCMinutes() + service.durationMinutes);

    const bookable = await assertSlotIsBookable(
      service.establishment,
      start,
      end,
      prof
    );
    if (!bookable.ok) {
      res.status(409).json({ message: bookable.reason });
      return;
    }

    const conflictFilter: Record<string, unknown> = {
      establishment: service.establishment,
      status: { $in: BUSY_STATUSES },
      scheduledAt: { $lt: end },
      endsAt: { $gt: start },
    };
    if (prof) conflictFilter.professional = prof;
    const conflito = await Booking.findOne(conflictFilter);
    if (conflito) {
      res.status(409).json({ message: "Horario nao esta mais disponivel" });
      return;
    }

    const booking = await Booking.create({
      client: req.userId,
      establishment: service.establishment,
      owner: establishment.owner,
      service: service._id,
      professional: prof,
      scheduledAt: start,
      endsAt: end,
      notes,
      address,
      clientReminderMinutes,
      payment: { status: "pendente", amount: service.price },
    });

    // notifica o lado do estabelecimento: dono e, se houver, o funcionario
    // vinculado ao profissional escolhido.
    const recipients = await establishmentRecipients(
      service.establishment,
      prof
    );

    // tempo real: emite para TODOS os envolvidos (dono + funcionario), senao
    // a lista do funcionario so atualiza ao recarregar a pagina
    const io = getIO();
    for (const userId of recipients) {
      io.to(`user:${userId}`).emit("booking:new", booking);
    }

    console.log("[createBooking] prof:", prof ? prof.toString() : "NULL");
    console.log("[createBooking] recipients:", recipients);

    const whenLabel = start.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    notifyManyAsync(recipients, {
      type: "booking_created",
      title: "Novo agendamento",
      body: `${service.title} em ${whenLabel}`,
      booking: booking._id,
      establishment: service.establishment,
    });

    // ---- e-mails (Etapa B) ----
    // Apenas o lado do estabelecimento (dono + funcionario) recebe e-mail ao
    // criar. O cliente NAO recebe e-mail agora — so quando o estabelecimento
    // CONFIRMAR o agendamento. Fire-and-forget.
    const [estMails, profNameCreated] = await Promise.all([
      establishmentEmailRecipients(service.establishment, prof),
      professionalNameOf(service.establishment, prof),
    ]);
    notifyBookingCreatedAsync({
      establishmentEmails: estMails,
      ctx: {
        serviceTitle: service.title,
        establishmentName: establishment.name,
        whenLabel,
        professionalName: profNameCreated,
      },
    });

    res.status(201).json(booking);
  } catch (err) {
    console.error("createBooking:", err);
    res.status(500).json({ message: "Erro ao criar agendamento" });
  }
};

// GET /api/bookings  (protegido)
export const listBookings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const role = req.query.role === "provider" ? "provider" : "client";
  const establishment = req.query.establishment as string | undefined;

  let filter: Record<string, unknown>;

  if (role === "client") {
    filter = { client: req.userId };
  } else {
    // role provider: pode ser o DONO ou um FUNCIONARIO (membro-profissional).
    // Dono ve todos os agendamentos do estabelecimento; funcionario ve apenas
    // aqueles em que ele e o profissional responsavel.
    filter = { owner: req.userId };

    if (establishment) {
      const est = await Establishment.findById(establishment).select(
        "owner professionals"
      );

      if (est && est.owner.toString() !== req.userId) {
        // nao e o dono: so pode ser funcionario. Descobre o professionalId dele
        // (o subdoc cujo linkedUser aponta para este user).
        const myProf = est.professionals.find(
          (p) => p.linkedUser && p.linkedUser.toString() === req.userId
        );

        if (!myProf) {
          // nem dono nem profissional vinculado: nao ve nada
          res.json([]);
          return;
        }

        // funcionario: filtra pelo estabelecimento e pelos agendamentos dele
        filter = { establishment, professional: myProf._id };
      } else {
        // e o dono: todos do estabelecimento
        filter = { owner: req.userId, establishment };
      }
    }
  }

  // reservas automaticas ainda nao aceitas nao aparecem para o estabelecimento:
  // so viram agendamento de verdade quando o cliente aceita (vira "pendente").
  if (role === "provider") {
    filter.status = { $ne: "reservado" };
  }

  const bookings = await Booking.find(filter)
    .populate("service", "title price durationMinutes description photos")
    .populate("client", "name avatar phone")
    .populate(
      "establishment",
      "name professionals photo address location phone"
    )
    .sort({ scheduledAt: 1 })
    .lean();

  // professional e subdoc de Establishment.professionals — nao ha populate.
  // Casa o id do profissional com o nome, dentro do establishment ja populado,
  // e anexa professionalName a cada booking.
  const withNames = bookings.map((b) => {
    const est = b.establishment as unknown as
      | {
          _id: Types.ObjectId;
          name: string;
          photo?: string;
          address?: unknown;
          location?: unknown;
          phone?: string;
          professionals?: Array<{ _id: Types.ObjectId; name: string }>;
        }
      | null
      | undefined;

    let professionalName: string | null = null;
    if (b.professional && est?.professionals) {
      const match = est.professionals.find(
        (p) => p._id.toString() === String(b.professional)
      );
      professionalName = match ? match.name : null;
    }

    // remove so a lista de profissionais (o front nao precisa dela aqui);
    // mantem foto, endereco, coordenadas e telefone para o card e o mapa.
    const establishmentTrimmed = est
      ? {
          _id: est._id,
          name: est.name,
          photo: est.photo,
          address: est.address,
          location: est.location,
          phone: est.phone,
        }
      : est;

    return {
      ...b,
      establishment: establishmentTrimmed,
      professionalName,
    };
  });

  res.json(withNames);
};

// PATCH /api/bookings/:id/status  (protegido)
// body: { status, paymentMethod? }
export const updateBookingStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, paymentMethod } = req.body;
    const allowed = ["confirmado", "concluido", "cancelado"];
    if (!allowed.includes(status)) {
      res.status(400).json({ message: "Status invalido" });
      return;
    }

    // antecedencia do lembrete do estabelecimento, escolhida por quem confirma.
    // So se aplica ao confirmar; valor invalido cai no padrao de 30 min.
    const ALLOWED_REMINDERS = [15, 30, 45, 60, 120, 180];
    const rawOwnerReminder = Number(req.body.ownerReminderMinutes);
    const ownerReminderChoice = ALLOWED_REMINDERS.includes(rawOwnerReminder)
      ? rawOwnerReminder
      : 30;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    const isOwner = booking.owner.toString() === req.userId;
    const isClient = booking.client.toString() === req.userId;

    // funcionario responsavel pelo agendamento tambem pode gerenciar (confirmar/
    // concluir/cancelar). Verifica se o user e o profissional do booking, via
    // linkedUser no subdoc do estabelecimento.
    let isAssignedProfessional = false;
    if (!isOwner && booking.professional) {
      const estProf = await Establishment.findById(
        booking.establishment
      ).select("professionals");
      const prof = estProf?.professionals.id(booking.professional);
      isAssignedProfessional =
        !!prof &&
        !!prof.linkedUser &&
        prof.linkedUser.toString() === req.userId;
    }

    if (
      !isOwner &&
      !isAssignedProfessional &&
      !(isClient && status === "cancelado")
    ) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    const wasActive = BUSY_STATUSES.includes(booking.status);

    if (status === "concluido") {
      if (!VALID_METHODS.includes(paymentMethod)) {
        res
          .status(400)
          .json({ message: "Informe a forma de pagamento para concluir" });
        return;
      }
      booking.payment.method = paymentMethod;
      booking.payment.status = "pago";
      booking.completedAt = new Date();
    }

    booking.status = status;
    // ao sair do estado reservado, limpa o prazo
    if (status !== "reservado") {
      booking.reservationExpiresAt = undefined;
    }

    // ao confirmar, grava a antecedencia do lembrete do estabelecimento e
    // reseta o carimbo (para o cron reenviar se o horario/confirmacao mudou)
    if (status === "confirmado" && (isOwner || isAssignedProfessional)) {
      booking.ownerReminderMinutes = ownerReminderChoice;
      booking.ownerReminderSentAt = undefined;
    }

    // quem agiu define o sentido do aviso. Acao do estabelecimento (confirmar,
    // cancelar) marca o badge do cliente. "concluido" NAO gera badge: o cliente
    // esteve presente e ja sabe.
    const actedByEstablishment = isOwner || isAssignedProfessional;
    if (actedByEstablishment && status !== "concluido") {
      booking.clientNotifiedAt = new Date();
    }

    await booking.save();

    if (status === "concluido") {
      const est = await Establishment.findById(booking.establishment).select(
        "cashAutoEntry"
      );
      const autoOn = est?.cashAutoEntry !== false;
      if (autoOn) {
        const openSession = await CashSession.findOne({
          establishment: booking.establishment,
          status: "aberto",
        });
        if (openSession) {
          await postBookingToCash(booking, openSession._id, req.userId!);
        }
      }
    }

    // tempo real: cliente + dono + funcionario do agendamento
    const estSide = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const io = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", booking);
    }

    // ---- notificacoes in-app ----
    const svc = await Service.findById(booking.service).select("title");
    const serviceTitle = svc?.title || "Agendamento";
    const when = booking.scheduledAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (actedByEstablishment) {
      // estabelecimento agiu -> avisa o CLIENTE
      if (status === "concluido") {
        // conclusao vira convite para avaliar. Regra: uma avaliacao por
        // SERVICO por cliente -> so pede se ainda nao avaliou esse servico.
        const alreadyReviewed = await Review.findOne({
          client: booking.client,
          service: booking.service,
        }).select("_id");
        if (!booking.reviewed && !alreadyReviewed) {
          // nome do estabelecimento para a mensagem ("Avalie o Salao X")
          const estForReview = await Establishment.findById(
            booking.establishment
          ).select("name");
          const estName = estForReview?.name || "o estabelecimento";
          notifyManyAsync([booking.client], {
            type: "review_request",
            title: `Avalie ${estName}`,
            body: `Como foi seu ${serviceTitle} em ${estName}? Toque para dar sua nota em estrelas.`,
            booking: booking._id,
            establishment: booking.establishment,
          });
        }
      } else {
        const titles: Record<string, string> = {
          confirmado: "Agendamento confirmado",
          cancelado: "Agendamento cancelado",
        };
        notifyManyAsync([booking.client], {
          type:
            status === "confirmado"
              ? "booking_confirmed"
              : "booking_cancelled",
          title: titles[status] || "Agendamento atualizado",
          body: `${serviceTitle} em ${when}`,
          booking: booking._id,
          establishment: booking.establishment,
        });
      }
    } else if (isClient && status === "cancelado") {
      // cliente cancelou -> avisa o estabelecimento (dono + funcionario)
      const recipients = await establishmentRecipients(
        booking.establishment,
        booking.professional
      );
      notifyManyAsync(recipients, {
        type: "booking_cancelled",
        title: "Agendamento cancelado pelo cliente",
        body: `${serviceTitle} em ${when}`,
        booking: booking._id,
        establishment: booking.establishment,
      });
    }

    // ---- e-mails (Etapa B) ----
    // Regras: estabelecimento confirma -> cliente; estabelecimento cancela ->
    // cliente. Concluir NAO gera e-mail (cliente esteve presente). Cliente
    // cancela NAO gera e-mail (so notificacao in-app).
    if (actedByEstablishment && (status === "confirmado" || status === "cancelado")) {
      const [clientMailU, estForNameU, profNameU] = await Promise.all([
        userEmail(booking.client),
        Establishment.findById(booking.establishment).select("name"),
        professionalNameOf(booking.establishment, booking.professional),
      ]);
      const ctxU = {
        serviceTitle,
        establishmentName: estForNameU?.name || "",
        whenLabel: when,
        professionalName: profNameU,
      };
      if (status === "confirmado") {
        notifyBookingConfirmedAsync({ clientEmail: clientMailU, ctx: ctxU });
      } else {
        notifyBookingCancelledClientAsync({
          clientEmail: clientMailU,
          ctx: ctxU,
        });
      }
    }

    // cancelamento libera a vaga: tenta reservar para o proximo da fila;
    // se nao houver quem reservar, notifica a fila normalmente.
    if (status === "cancelado" && wasActive) {
      const reserved = await autoReserveSlot(
        booking.establishment,
        booking.service,
        booking.professional,
        booking.scheduledAt,
        booking.endsAt
      );
      if (!reserved) {
        await notifyWaitlistOpening(
          booking.establishment,
          booking.service,
          booking.scheduledAt,
          booking.professional
        );
      }
    }

    res.json(booking);
  } catch (err) {
    console.error("updateBookingStatus:", err);
    res.status(500).json({ message: "Erro ao atualizar agendamento" });
  }
};

// PATCH /api/bookings/:id/reschedule  (protegido)
export const rescheduleBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { scheduledAt, professionalId } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    const isOwner = booking.owner.toString() === req.userId;
    const isClient = booking.client.toString() === req.userId;

    // funcionario responsavel pelo agendamento tambem pode reagendar (mesmo
    // padrao do updateBookingStatus): e o profissional do booking cujo
    // linkedUser aponta para este user.
    let isAssignedProfessional = false;
    if (!isOwner && booking.professional) {
      const estProf = await Establishment.findById(
        booking.establishment
      ).select("professionals");
      const profDoc = estProf?.professionals.id(booking.professional);
      isAssignedProfessional =
        !!profDoc &&
        !!profDoc.linkedUser &&
        profDoc.linkedUser.toString() === req.userId;
    }

    if (!isOwner && !isClient && !isAssignedProfessional) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    // funcionario reagendando conta como o ESTABELECIMENTO agindo (avisa o
    // cliente), nao como o cliente.
    const actedByEstablishment = isOwner || isAssignedProfessional;

    if (booking.status === "concluido" || booking.status === "cancelado") {
      res.status(400).json({
        message: "Nao e possivel reagendar um agendamento concluido ou cancelado",
      });
      return;
    }

    const start = new Date(scheduledAt);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "Data/hora invalida" });
      return;
    }

    const service = await Service.findById(booking.service);
    if (!service) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }
    const end = new Date(start);
    end.setUTCMinutes(end.getUTCMinutes() + service.durationMinutes);

    let prof: Types.ObjectId | null = booking.professional
      ? new Types.ObjectId(booking.professional.toString())
      : null;
    if (professionalId !== undefined) {
      prof = parseProfessional(professionalId);
    }

    const establishment = await Establishment.findById(booking.establishment);
    if (establishment) {
      const activePros = establishment.professionals.filter((p) => p.active);
      if (activePros.length > 0 && !prof) {
        res
          .status(400)
          .json({ message: "Escolha um profissional para reagendar" });
        return;
      }
      if (prof) {
        const exists = activePros.some(
          (p) => p._id.toString() === prof!.toString()
        );
        if (!exists) {
          res
            .status(404)
            .json({ message: "Profissional nao encontrado ou inativo" });
          return;
        }
      }
    }

    if (!professionalDoesService(service.professionals, prof)) {
      res
        .status(400)
        .json({ message: "Este profissional nao realiza o servico" });
      return;
    }

    const bookable = await assertSlotIsBookable(
      booking.establishment,
      start,
      end,
      prof
    );
    if (!bookable.ok) {
      res.status(409).json({ message: bookable.reason });
      return;
    }

    const conflictFilter: Record<string, unknown> = {
      _id: { $ne: booking._id },
      establishment: booking.establishment,
      status: { $in: BUSY_STATUSES },
      scheduledAt: { $lt: end },
      endsAt: { $gt: start },
    };
    if (prof) conflictFilter.professional = prof;
    const conflito = await Booking.findOne(conflictFilter);
    if (conflito) {
      res.status(409).json({ message: "Horario nao esta disponivel" });
      return;
    }

    booking.rescheduleHistory.push({
      previousScheduledAt: booking.scheduledAt,
      previousEndsAt: booking.endsAt,
      rescheduledBy: req.userId as unknown as (typeof booking.client),
      rescheduledByRole: isOwner
        ? "dono"
        : isAssignedProfessional
          ? "profissional"
          : "cliente",
      at: new Date(),
    });

    booking.scheduledAt = start;
    booking.endsAt = end;
    booking.professional = prof;
    booking.status = "pendente";
    booking.reservationExpiresAt = undefined;
    // horario mudou: rearma os lembretes ja enviados para o novo horario.
    // (o do estabelecimento sera regravado na proxima confirmacao)
    booking.clientReminderSentAt = undefined;
    booking.ownerReminderSentAt = undefined;

    // reagendamento feito pelo estabelecimento (dono OU funcionario) marca o
    // badge do cliente
    if (actedByEstablishment) {
      booking.clientNotifiedAt = new Date();
    }

    await booking.save();

    // tempo real: cliente + dono + funcionario
    const estSideR = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const ioR = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSideR])) {
      ioR.to(`user:${uid}`).emit("booking:rescheduled", booking);
    }
    // ---- notificacoes in-app ----
    const whenNew = start.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (actedByEstablishment) {
      // estabelecimento (dono ou funcionario) reagendou -> avisa o cliente
      notifyManyAsync([booking.client], {
        type: "booking_rescheduled",
        title: "Agendamento remarcado",
        body: `${service.title} agora em ${whenNew}`,
        booking: booking._id,
        establishment: booking.establishment,
      });
    } else {
      // cliente reagendou -> avisa o estabelecimento
      const recipients = await establishmentRecipients(
        booking.establishment,
        prof
      );
      notifyManyAsync(recipients, {
        type: "booking_rescheduled",
        title: "Agendamento remarcado pelo cliente",
        body: `${service.title} agora em ${whenNew}`,
        booking: booking._id,
        establishment: booking.establishment,
      });
    }

    // ---- e-mails (Etapa B) ----
    // estabelecimento reagenda -> cliente; cliente reagenda -> dono + funcionario.
    const estForNameR = establishment || (await Establishment.findById(
      booking.establishment
    ).select("name"));
    const profNameR = await professionalNameOf(booking.establishment, prof);
    const ctxR = {
      serviceTitle: service.title,
      establishmentName: estForNameR?.name || "",
      whenLabel: whenNew,
      professionalName: profNameR,
    };
    if (actedByEstablishment) {
      const clientMailR = await userEmail(booking.client);
      notifyBookingRescheduledClientAsync({
        clientEmail: clientMailR,
        ctx: ctxR,
      });
    } else {
      const estMailsR = await establishmentEmailRecipients(
        booking.establishment,
        prof
      );
      notifyBookingRescheduledEstablishmentAsync({
        establishmentEmails: estMailsR,
        ctx: ctxR,
      });
    }

    res.json(booking);
  } catch (err) {
    console.error("Erro ao reagendar:", err);
    res.status(500).json({ message: "Erro ao reagendar agendamento" });
  }
};

// GET /api/bookings/clients/:establishmentId  (protegido, dono/equipe)
export const listEstablishmentClients = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;

    const est = await Establishment.findOne({
      _id: establishmentId,
      $or: [{ owner: req.userId }, { "members.professional": req.userId }],
    }).select("_id");
    if (!est) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const rows = await Booking.aggregate([
      { $match: { establishment: new Types.ObjectId(String(establishmentId)) } },
      {
        $group: {
          _id: "$client",
          bookingCount: { $sum: 1 },
          lastBooking: { $max: "$scheduledAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: "$client" },
      {
        $project: {
          _id: "$client._id",
          name: "$client.name",
          avatar: "$client.avatar",
          bookingCount: 1,
          lastBooking: 1,
        },
      },
      { $sort: { lastBooking: -1 } },
    ]);

    res.json(rows);
  } catch (err) {
    console.error("listEstablishmentClients:", err);
    res.status(500).json({ message: "Erro ao listar clientes" });
  }
};

// GET /api/bookings/history/:establishmentId/:clientId  (protegido, dono/equipe)
export const clientHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;

    const est = await Establishment.findOne({
      _id: establishmentId,
      $or: [{ owner: req.userId }, { "members.professional": req.userId }],
    }).select("professionals");
    if (!est) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const nameById = new Map<string, string>();
    est.professionals.forEach((p) => nameById.set(p._id.toString(), p.name));

    const bookings = await Booking.find({
      establishment: establishmentId,
      client: clientId,
      status: "concluido",
    })
      .populate("service", "title")
      .sort({ scheduledAt: -1 });

    const history = bookings.map((b) => ({
      _id: b._id,
      scheduledAt: b.scheduledAt,
      completedAt: b.completedAt ?? null,
      serviceTitle:
        (b.service as unknown as { title?: string })?.title ?? "Serviço",
      professionalName: b.professional
        ? nameById.get(b.professional.toString()) ?? null
        : null,
      amount: b.payment?.amount ?? 0,
      method: b.payment?.method ?? "",
    }));

    res.json(history);
  } catch (err) {
    console.error("clientHistory:", err);
    res.status(500).json({ message: "Erro ao buscar historico do cliente" });
  }
};

// POST /api/bookings/recurring  (protegido)
export const createRecurringBookings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      serviceId,
      scheduledAt,
      professionalId,
      notes,
      address,
      frequency,
      repetitions,
    } = req.body;

    // antecedencia do lembrete escolhida pelo cliente, aplicada a serie toda
    const ALLOWED_REMINDERS = [15, 30, 45, 60, 120, 180];
    const rawReminder = Number(req.body.clientReminderMinutes);
    const clientReminderMinutes = ALLOWED_REMINDERS.includes(rawReminder)
      ? rawReminder
      : 60;

    if (!["semanal", "quinzenal"].includes(frequency)) {
      res.status(400).json({ message: "Frequencia invalida" });
      return;
    }
    const reps = Number(repetitions);
    if (!Number.isInteger(reps) || reps < 2 || reps > 52) {
      res
        .status(400)
        .json({ message: "Numero de repeticoes invalido (2 a 52)" });
      return;
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }

    const establishment = await Establishment.findById(service.establishment);
    if (!establishment) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    const prof = parseProfessional(professionalId);
    const activePros = establishment.professionals.filter((p) => p.active);

    if (activePros.length > 0 && !prof) {
      res
        .status(400)
        .json({ message: "Escolha um profissional para este agendamento" });
      return;
    }
    if (prof) {
      const exists = activePros.some((p) => p._id.toString() === prof.toString());
      if (!exists) {
        res
          .status(404)
          .json({ message: "Profissional nao encontrado ou inativo" });
        return;
      }
    }
    if (!professionalDoesService(service.professionals, prof)) {
      res
        .status(400)
        .json({ message: "Este profissional nao realiza o servico escolhido" });
      return;
    }

    const firstStart = new Date(scheduledAt);
    if (isNaN(firstStart.getTime())) {
      res.status(400).json({ message: "Data/hora invalida" });
      return;
    }

    const stepDays = frequency === "semanal" ? 7 : 14;
    const seriesId = new Types.ObjectId();

    const created: unknown[] = [];
    const skipped: { date: string; reason: string }[] = [];

    for (let i = 0; i < reps; i++) {
      const start = new Date(firstStart);
      start.setDate(start.getDate() + i * stepDays);

      const end = new Date(start);
      end.setUTCMinutes(end.getUTCMinutes() + service.durationMinutes);

      const bookable = await assertSlotIsBookable(
        service.establishment,
        start,
        end,
        prof
      );
      if (!bookable.ok) {
        skipped.push({
          date: start.toISOString(),
          reason: bookable.reason || "Indisponivel",
        });
        continue;
      }

      const conflictFilter: Record<string, unknown> = {
        establishment: service.establishment,
        status: { $in: BUSY_STATUSES },
        scheduledAt: { $lt: end },
        endsAt: { $gt: start },
      };
      if (prof) conflictFilter.professional = prof;
      const conflito = await Booking.findOne(conflictFilter);
      if (conflito) {
        skipped.push({
          date: start.toISOString(),
          reason: "Horario ja ocupado",
        });
        continue;
      }

      const booking = await Booking.create({
        client: req.userId,
        establishment: service.establishment,
        owner: establishment.owner,
        service: service._id,
        professional: prof,
        seriesId,
        scheduledAt: start,
        endsAt: end,
        notes,
        address,
        clientReminderMinutes,
        payment: { status: "pendente", amount: service.price },
      });

      created.push(booking);
    }

    if (created.length === 0) {
      res.status(409).json({
        message: "Nenhum horario da serie esta disponivel",
        created: [],
        skipped,
      });
      return;
    }

    // avisa todos os envolvidos do lado do estabelecimento (dono + funcionario
    // vinculado), nao so o dono. Um emit basta: o BookingList recarrega a lista.
    const recipients = await establishmentRecipients(
      service.establishment,
      prof
    );
    const io = getIO();
    for (const uid of recipients) {
      io.to(`user:${uid}`).emit("booking:new", created[0]);
    }

    res.status(201).json({
      seriesId: seriesId.toString(),
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  } catch (err) {
    console.error("createRecurringBookings:", err);
    res.status(500).json({ message: "Erro ao criar agendamentos recorrentes" });
  }
};

// DELETE /api/bookings/series/:seriesId  (protegido)
export const cancelSeries = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { seriesId } = req.params;
    if (!Types.ObjectId.isValid(seriesId)) {
      res.status(400).json({ message: "Serie invalida" });
      return;
    }

    const sample = await Booking.findOne({ seriesId });
    if (!sample) {
      res.status(404).json({ message: "Serie nao encontrada" });
      return;
    }

    const isOwner = sample.owner.toString() === req.userId;
    const isClient = sample.client.toString() === req.userId;
    if (!isOwner && !isClient) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    const now = new Date();
    const result = await Booking.updateMany(
      {
        seriesId,
        status: { $in: BUSY_STATUSES },
        scheduledAt: { $gte: now },
      },
      { $set: { status: "cancelado" } }
    );

    // avisa cliente + lado do estabelecimento (dono + funcionario vinculado)
    const estSide = await establishmentRecipients(
      sample.establishment,
      sample.professional
    );
    const io = getIO();
    for (const uid of new Set([sample.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", { seriesId });
    }

    res.json({
      message: "Serie cancelada",
      cancelledCount: result.modifiedCount ?? 0,
    });
  } catch (err) {
    console.error("cancelSeries:", err);
    res.status(500).json({ message: "Erro ao cancelar a serie" });
  }
};

// PATCH /api/bookings/:id/accept-reservation  (protegido, so o cliente)
// aceita uma reserva automatica: vira "pendente" (aguarda confirmacao do dono)
export const acceptReservation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    if (booking.client.toString() !== req.userId) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    if (booking.status !== "reservado") {
      res.status(400).json({ message: "Esta reserva nao esta mais ativa" });
      return;
    }

    // prazo vencido?
    if (
      booking.reservationExpiresAt &&
      booking.reservationExpiresAt.getTime() <= Date.now()
    ) {
      res.status(409).json({ message: "O prazo desta reserva expirou" });
      return;
    }

    booking.status = "pendente";
    booking.reservationExpiresAt = undefined;
    await booking.save();

    // marca a entrada da fila como atendida
    if (booking.fromWaitlist) {
      const { Waitlist } = await import("../models/Waitlist");
      await Waitlist.updateOne(
        { _id: booking.fromWaitlist },
        { $set: { status: "atendido" } }
      );
    }

    // avisa cliente + lado do estabelecimento (dono + funcionario vinculado):
    // agora ha um pendente aguardando confirmacao, e o funcionario do
    // agendamento precisa ve-lo aparecer para confirmar
    const estSide = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const io = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", booking);
    }

    res.json(booking);
  } catch (err) {
    console.error("acceptReservation:", err);
    res.status(500).json({ message: "Erro ao aceitar a reserva" });
  }
};

// PATCH /api/bookings/:id/decline-reservation  (protegido, so o cliente)
// recusa a reserva: cancela e passa a vaga para o proximo da fila
export const declineReservation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    if (booking.client.toString() !== req.userId) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    if (booking.status !== "reservado") {
      res.status(400).json({ message: "Esta reserva nao esta mais ativa" });
      return;
    }

    booking.status = "cancelado";
    booking.reservationExpiresAt = undefined;
    await booking.save();

    // tira a pessoa da fila (ela recusou)
    if (booking.fromWaitlist) {
      const { Waitlist } = await import("../models/Waitlist");
      await Waitlist.updateOne(
        { _id: booking.fromWaitlist },
        { $set: { status: "cancelado" } }
      );
    }

    // avisa cliente + lado do estabelecimento (dono + funcionario vinculado)
    const estSide = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const io = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", booking);
    }

    // passa a vaga para o proximo da fila
    const excluded = booking.fromWaitlist ? [booking.fromWaitlist] : [];
    await autoReserveSlot(
      booking.establishment,
      booking.service,
      booking.professional,
      booking.scheduledAt,
      booking.endsAt,
      excluded
    );

    res.json(booking);
  } catch (err) {
    console.error("declineReservation:", err);
    res.status(500).json({ message: "Erro ao recusar a reserva" });
  }
};