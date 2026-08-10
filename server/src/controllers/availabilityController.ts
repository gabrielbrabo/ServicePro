import { Request, Response } from "express";
import { Availability } from "../models/Availability";
import { Booking } from "../models/Booking";
import { Service } from "../models/Service";
import { Establishment } from "../models/Establishment";
import { TimeBlock } from "../models/TimeBlock";
import { AuthRequest } from "../middleware/auth";
import { Types } from "mongoose";

const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  });
  return !!est;
};

const isValidBlock = (s: any): boolean =>
  typeof s?.startMinute === "number" &&
  typeof s?.endMinute === "number" &&
  s.startMinute >= 0 &&
  s.endMinute <= 1440 &&
  s.startMinute < s.endMinute;

// normaliza um professional vindo de query/body para ObjectId ou null
const parseProfessional = (value: unknown): Types.ObjectId | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

// PUT /api/availability/:establishmentId  (protegido)
// body pode conter professional (id do profissional) ou omitir (agenda geral)
export const setAvailability = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const {
      workingHours = [],
      breaks = [],
      minAdvanceMinutes = 30,
      maxFutureDays = 30,
      professional,
    } = req.body;

    if (!Array.isArray(workingHours) || !Array.isArray(breaks)) {
      res
        .status(400)
        .json({ message: "workingHours e breaks devem ser arrays" });
      return;
    }

    for (const w of workingHours) {
      if (
        typeof w?.dayOfWeek !== "number" ||
        w.dayOfWeek < 0 ||
        w.dayOfWeek > 6 ||
        !isValidBlock(w)
      ) {
        res.status(400).json({ message: "workingHours invalido" });
        return;
      }
    }

    for (const b of breaks) {
      const dayOk =
        b?.dayOfWeek === null ||
        b?.dayOfWeek === undefined ||
        (typeof b.dayOfWeek === "number" && b.dayOfWeek >= 0 && b.dayOfWeek <= 6);
      if (!dayOk || !isValidBlock(b)) {
        res.status(400).json({ message: "breaks invalido" });
        return;
      }
    }

    if (typeof minAdvanceMinutes !== "number" || minAdvanceMinutes < 0) {
      res.status(400).json({ message: "minAdvanceMinutes invalido" });
      return;
    }
    if (typeof maxFutureDays !== "number" || maxFutureDays < 1) {
      res.status(400).json({ message: "maxFutureDays invalido" });
      return;
    }

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const prof = parseProfessional(professional);

    // se veio profissional, valida que ele existe e esta no estabelecimento
    if (prof) {
      const est = await Establishment.findOne({
        _id: establishmentId,
        "professionals._id": prof,
      });
      if (!est) {
        res
          .status(404)
          .json({ message: "Profissional nao encontrado no estabelecimento" });
        return;
      }
    }

    const normalizedBreaks = breaks.map((b: any) => ({
      dayOfWeek:
        b.dayOfWeek === null || b.dayOfWeek === undefined ? null : b.dayOfWeek,
      startMinute: b.startMinute,
      endMinute: b.endMinute,
      label: b.label || "",
    }));

    const availability = await Availability.findOneAndUpdate(
      { establishment: establishmentId, professional: prof },
      {
        establishment: establishmentId,
        professional: prof,
        workingHours,
        breaks: normalizedBreaks,
        minAdvanceMinutes,
        maxFutureDays,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(availability);
  } catch (err) {
    console.error("setAvailability:", err);
    res.status(500).json({ message: "Erro ao salvar disponibilidade" });
  }
};

// GET /api/availability/:establishmentId
// ?professional=ID  -> agenda daquele profissional; ausente -> agenda geral
export const getAvailability = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const prof = parseProfessional(req.query.professional);

    const availability = await Availability.findOne({
      establishment: req.params.establishmentId,
      professional: prof,
    });
    if (!availability) {
      res.json({
        establishment: req.params.establishmentId,
        professional: prof,
        workingHours: [],
        breaks: [],
        minAdvanceMinutes: 30,
        maxFutureDays: 30,
      });
      return;
    }
    res.json(availability);
  } catch (err) {
    console.error("getAvailability:", err);
    res.status(500).json({ message: "Erro ao buscar disponibilidade" });
  }
};

// GET /api/services/:serviceId/slots?date=YYYY-MM-DD&professional=ID
// professional opcional: se presente, usa a agenda e os bookings daquele
// profissional; se ausente, usa a agenda geral do estabelecimento.
export const getFreeSlots = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const dateStr = String(req.query.date || "");
    const prof = parseProfessional(req.query.professional);

    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }

    // valida formato YYYY-MM-DD
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) {
      res.status(400).json({ message: "Data invalida (use YYYY-MM-DD)" });
      return;
    }
    const year = Number(m[1]);
    const month = Number(m[2]); // 1-12
    const day = Number(m[3]);

    // agenda do profissional (se informado) ou a geral do estabelecimento
    const availability = await Availability.findOne({
      establishment: service.establishment,
      professional: prof,
    });
    if (!availability || availability.workingHours.length === 0) {
      res.json({ date: dateStr, slots: [] });
      return;
    }

    const now = new Date();

    // dia da semana estável (meio-dia local para não escorregar de dia)
    const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);
    const dayOfWeek = localNoon.getDay(); // 0=domingo ... 6=sabado

    // ---- janela de dias futuros (comparação só por data) ----
    const todayMid = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const targetMid = new Date(year, month - 1, day);
    const diffDays = Math.round(
      (targetMid.getTime() - todayMid.getTime()) / 86400000
    );
    if (diffDays < 0 || diffDays > availability.maxFutureDays) {
      res.json({ date: dateStr, slots: [] });
      return;
    }

    const workBlocks = availability.workingHours.filter(
      (w) => w.dayOfWeek === dayOfWeek
    );
    if (workBlocks.length === 0) {
      res.json({ date: dateStr, slots: [] });
      return;
    }

    const dayBreaks = availability.breaks.filter(
      (b) => b.dayOfWeek === null || b.dayOfWeek === dayOfWeek
    );

    // constrói um Date LOCAL para um dado minuto desde a meia-noite do dia pedido
    const atMinute = (minute: number) =>
      new Date(year, month - 1, day, 0, minute, 0, 0);

    const dayStart = atMinute(0);
    const nextDayStart = new Date(dayStart.getTime() + 86400000);

    // agendamentos do dia: se ha profissional, so os DELE; senao, do estab.
    const bookingFilter: Record<string, unknown> = {
      establishment: service.establishment,
      status: { $in: ["pendente", "confirmado", "reservado"] },
      scheduledAt: { $gte: dayStart, $lt: nextDayStart },
    };
    if (prof) bookingFilter.professional = prof;
    const bookings = await Booking.find(bookingFilter);

    // bloqueios que tocam o dia. Considera os do estabelecimento inteiro
    // (professional=null) E os do profissional selecionado (se houver).
    const blockFilter: Record<string, unknown> = {
      establishment: service.establishment,
      startAt: { $lt: nextDayStart },
      endAt: { $gt: dayStart },
    };
    if (prof) {
      blockFilter.$or = [{ professional: null }, { professional: prof }];
    } else {
      blockFilter.professional = null;
    }
    const dayBlocks = await TimeBlock.find(blockFilter);

    const minStart = new Date(
      now.getTime() + availability.minAdvanceMinutes * 60000
    );

    const duration = service.durationMinutes;
    const slots: string[] = [];

    const overlaps = (
      aStart: Date,
      aEnd: Date,
      bStart: Date,
      bEnd: Date
    ): boolean => aStart < bEnd && aEnd > bStart;

    for (const block of workBlocks) {
      for (
        let min = block.startMinute;
        min + duration <= block.endMinute;
        min += duration
      ) {
        const slotStart = atMinute(min);
        const slotEnd = atMinute(min + duration);

        if (slotStart < minStart) continue;

        const emBreak = dayBreaks.some((br) =>
          overlaps(
            slotStart,
            slotEnd,
            atMinute(br.startMinute),
            atMinute(br.endMinute)
          )
        );
        if (emBreak) continue;

        const emBloqueio = dayBlocks.some((blk) =>
          overlaps(slotStart, slotEnd, blk.startAt, blk.endAt)
        );
        if (emBloqueio) continue;

        const conflito = bookings.some((b) =>
          overlaps(slotStart, slotEnd, b.scheduledAt, b.endsAt)
        );
        if (conflito) continue;

        slots.push(slotStart.toISOString());
      }
    }

    res.json({ date: dateStr, slots });
  } catch (err) {
    console.error("getFreeSlots:", err);
    res.status(500).json({ message: "Erro ao calcular horarios livres" });
  }
};