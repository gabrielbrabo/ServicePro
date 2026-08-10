import { Waitlist } from "../models/Waitlist";
import { Establishment } from "../models/Establishment";
import { getIO } from "../socket";
import { Types } from "mongoose";

// Quando um horario e liberado (booking cancelado), avisa os interessados na
// fila daquele servico. Casa por dia (targetDate) e por profissional.
//
// slotStart: inicio do horario liberado.
// professional: profissional do booking cancelado (null se sem equipe).
//
// Notifica quem espera:
// - aquele dia especifico OU qualquer dia (targetDate null), E
// - aquele profissional OU qualquer profissional (professional null)
export const notifyWaitlistOpening = async (
  establishmentId: Types.ObjectId,
  serviceId: Types.ObjectId,
  slotStart: Date,
  professional?: Types.ObjectId | null
): Promise<void> => {
  try {
    const dayStart = new Date(
      slotStart.getFullYear(),
      slotStart.getMonth(),
      slotStart.getDate(),
      0,
      0,
      0,
      0
    );

    // condicao de profissional: sempre inclui quem espera "qualquer um" (null);
    // se a vaga tem profissional, inclui tambem quem espera exatamente ele.
    const profCond: Record<string, unknown>[] = [{ professional: null }];
    if (professional) profCond.push({ professional });

    const interessados = await Waitlist.find({
      establishment: establishmentId,
      service: serviceId,
      status: "aguardando",
      $and: [
        { $or: [{ targetDate: null }, { targetDate: dayStart }] },
        { $or: profCond },
      ],
    })
      .sort({ createdAt: 1 }) // FIFO
      .populate("service", "title");

    if (interessados.length === 0) return;

    // resolve o nome do profissional (se houver) para exibir no aviso
    let professionalName: string | null = null;
    if (professional) {
      const est = await Establishment.findById(establishmentId).select(
        "professionals"
      );
      const p = est?.professionals.find(
        (x) => x._id.toString() === professional.toString()
      );
      professionalName = p?.name ?? null;
    }

    const io = getIO();
    const basePayload = {
      establishment: establishmentId.toString(),
      service: serviceId.toString(),
      slotStart: slotStart.toISOString(),
      professional: professional ? professional.toString() : null,
      professionalName,
    };

    for (const entry of interessados) {
      entry.status = "notificado";
      entry.notifiedAt = new Date();
      await entry.save();

      io.to(`user:${entry.client.toString()}`).emit("waitlist:opening", {
        ...basePayload,
        waitlistId: entry._id.toString(),
        serviceTitle: (entry.service as unknown as { title?: string })?.title,
      });
    }
  } catch (err) {
    console.error("notifyWaitlistOpening:", err);
  }
};