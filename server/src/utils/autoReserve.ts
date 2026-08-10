import { Booking } from "../models/Booking";
import { Waitlist } from "../models/Waitlist";
import { Service } from "../models/Service";
import { Establishment } from "../models/Establishment";
import { getIO } from "../socket";
import { Types } from "mongoose";

// prazo padrao para confirmar uma reserva automatica
const RESERVATION_MINUTES = 60;
// se a vaga comeca em menos que isso, nao vale reservar (sem tempo habil)
const MIN_LEAD_MINUTES = 15;

// Tenta reservar uma vaga liberada para o PROXIMO da fila.
// Retorna o booking criado, ou null se nao houve para quem reservar.
//
// excludeWaitlistIds: entradas ja tentadas (para o job pular ao passar adiante).
export const autoReserveSlot = async (
  establishmentId: Types.ObjectId,
  serviceId: Types.ObjectId,
  professional: Types.ObjectId | null,
  slotStart: Date,
  slotEnd: Date,
  excludeWaitlistIds: Types.ObjectId[] = []
): Promise<boolean> => {
  try {
    const now = new Date();

    // vaga muito em cima? nao reserva (sem tempo para confirmar)
    const leadMinutes = (slotStart.getTime() - now.getTime()) / 60000;
    if (leadMinutes < MIN_LEAD_MINUTES) return false;

    // dia do slot para casar com targetDate
    const dayStart = new Date(
      slotStart.getFullYear(),
      slotStart.getMonth(),
      slotStart.getDate(),
      0,
      0,
      0,
      0
    );

    const profCond: Record<string, unknown>[] = [{ professional: null }];
    if (professional) profCond.push({ professional });

    // proximo da fila (FIFO) que aceita este dia e este profissional
    const next = await Waitlist.findOne({
      establishment: establishmentId,
      service: serviceId,
      status: "aguardando",
      _id: { $nin: excludeWaitlistIds },
      $and: [
        { $or: [{ targetDate: null }, { targetDate: dayStart }] },
        { $or: profCond },
      ],
    }).sort({ createdAt: 1 });

    if (!next) return false;

    // o horario ainda esta livre? (trava contra corrida)
    const conflictFilter: Record<string, unknown> = {
      establishment: establishmentId,
      status: { $in: ["pendente", "confirmado", "reservado"] },
      scheduledAt: { $lt: slotEnd },
      endsAt: { $gt: slotStart },
    };
    if (professional) conflictFilter.professional = professional;
    const conflito = await Booking.findOne(conflictFilter);
    if (conflito) return false;

    const service = await Service.findById(serviceId).select("price title");
    const establishment = await Establishment.findById(establishmentId).select(
      "owner"
    );
    if (!service || !establishment) return false;

    // prazo: 1h, mas nunca depois do inicio do atendimento
    const byPolicy = new Date(now.getTime() + RESERVATION_MINUTES * 60000);
    const expiresAt = byPolicy < slotStart ? byPolicy : slotStart;

    const booking = await Booking.create({
      client: next.client,
      establishment: establishmentId,
      owner: establishment.owner,
      service: serviceId,
      professional,
      scheduledAt: slotStart,
      endsAt: slotEnd,
      status: "reservado",
      reservationExpiresAt: expiresAt,
      fromWaitlist: next._id,
      payment: { status: "pendente", amount: service.price },
    });

    // marca a entrada da fila como notificada
    next.status = "notificado";
    next.notifiedAt = new Date();
    await next.save();

    // avisa o cliente que tem uma reserva esperando confirmacao
    getIO()
      .to(`user:${next.client.toString()}`)
      .emit("waitlist:reserved", {
        bookingId: booking._id.toString(),
        establishment: establishmentId.toString(),
        service: serviceId.toString(),
        serviceTitle: service.title,
        slotStart: slotStart.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

    // avisa o dono que uma vaga foi reservada automaticamente
    /*getIO()
      .to(`user:${establishment.owner.toString()}`)
      .emit("booking:new", booking);
    */
    return true;
  } catch (err) {
    console.error("autoReserveSlot:", err);
    return false;
  }
};

// Expira reservas vencidas e tenta passar a vaga para o proximo da fila.
// Chamado periodicamente pelo job.
export const expireReservations = async (): Promise<number> => {
  const now = new Date();

  const vencidas = await Booking.find({
    status: "reservado",
    reservationExpiresAt: { $lte: now },
  });

  let count = 0;
  for (const b of vencidas) {
    // cancela a reserva vencida
    b.status = "cancelado";
    await b.save();
    count++;

    // avisa as partes
    getIO()
      .to(`user:${b.client.toString()}`)
      .to(`user:${b.owner.toString()}`)
      .emit("booking:updated", b);

    // passa a vaga para o proximo da fila (pulando quem ja recusou/expirou)
    const excluded = b.fromWaitlist ? [b.fromWaitlist] : [];
    await autoReserveSlot(
      b.establishment,
      b.service,
      b.professional,
      b.scheduledAt,
      b.endsAt,
      excluded
    );
  }

  return count;
};