import { Request, Response } from "express";
import { Availability } from "../models/Availability";
import { Booking } from "../models/Booking";
import { Service, effectiveDuration } from "../models/Service";
import { Establishment } from "../models/Establishment";
import { TimeBlock } from "../models/TimeBlock";
import { AuthRequest } from "../middleware/auth";
import {
  computeBusySegments,
  bookingSegments,
  segmentsOverlap,
} from "../utils/busySegments";
import { estimateTravel } from "../utils/travel";
import { Types } from "mongoose";

// tempo de deslocamento (UM trecho, em min) para horarios a domicilio; 0 se
// nao aplicavel. Le atHome/lat/lng da query + a config do estabelecimento.
async function homeTravelOneWay(
  req: Request,
  establishmentId: Types.ObjectId | string
): Promise<number> {
  if (req.query.atHome !== "true" && req.query.atHome !== "1") return 0;
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0;
  const est = await Establishment.findById(establishmentId).select(
    "location homeService"
  );
  if (!est) return 0;
  const coords = est.location?.coordinates;
  if (!coords || (coords[0] === 0 && coords[1] === 0)) return 0;
  const speed = est.homeService?.avgSpeedKmh || 25;
  const t = estimateTravel(
    { lat: coords[1], lon: coords[0] },
    { lat, lon: lng },
    speed
  );
  return t.oneWayMinutes;
}

// granularidade da grade de horarios (min). A grade anda de SLOT_STEP em
// SLOT_STEP (nao mais do tamanho do servico), para aproveitar melhor o dia
// quando ha folga/buffer. O servico ainda precisa CABER (min + duracao <= fim).
const SLOT_STEP = 15;

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

    // duracao efetiva por profissional (override) e folga do servico
    const duration = effectiveDuration(service, prof);
    const newBuffer = service.bufferMinutes || 0;
    // deslocamento (a domicilio): ocupa antes/depois de cada horario candidato
    const travelMin = await homeTravelOneWay(req, service.establishment);
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
        min += SLOT_STEP
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

        // conflito por SEGMENTOS: a pausa de processamento (do candidato e dos
        // agendamentos existentes) nao ocupa o profissional, entao nao bloqueia.
        const candSegs = computeBusySegments(
          [service],
          slotStart,
          prof,
          newBuffer,
          travelMin,
          travelMin
        );
        if (bookings.some((b) => segmentsOverlap(candSegs, bookingSegments(b))))
          continue;

        slots.push(slotStart.toISOString());
      }
    }

    res.json({ date: dateStr, slots });
  } catch (err) {
    console.error("getFreeSlots:", err);
    res.status(500).json({ message: "Erro ao calcular horarios livres" });
  }
};

// GET /api/availability/combo-slots?establishment=ID&serviceIds=a,b,c&date=YYYY-MM-DD&professional=ID
// horarios livres para um COMBO (varios servicos): usa a SOMA das duracoes.
// Mesma logica do getFreeSlots, mas a duracao vem do conjunto de servicos.
export const getComboSlots = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const establishmentId = String(req.query.establishment || "");
    const dateStr = String(req.query.date || "");
    const prof = parseProfessional(req.query.professional);

    if (!Types.ObjectId.isValid(establishmentId)) {
      res.status(400).json({ message: "Estabelecimento invalido" });
      return;
    }

    // serviceIds: aceita array repetido ou string separada por virgula
    const raw = req.query.serviceIds;
    const ids = (Array.isArray(raw) ? raw.map(String) : String(raw || "").split(","))
      .map((s) => s.trim())
      .filter((s) => Types.ObjectId.isValid(s));
    if (ids.length === 0) {
      res.status(400).json({ message: "Informe os servicos" });
      return;
    }

    const services = await Service.find({
      _id: { $in: ids },
      establishment: establishmentId,
    });
    if (services.length !== new Set(ids).size) {
      res.status(400).json({ message: "Servico(s) invalido(s)" });
      return;
    }
    // duracao total = soma das duracoes efetivas (override por profissional),
    // respeitando repeticoes em ids. buffer do combo = maior entre os servicos.
    const durById = new Map<string, number>();
    const svcById = new Map(services.map((s) => [String(s._id), s]));
    let newBuffer = 0;
    services.forEach((s) => {
      durById.set(String(s._id), effectiveDuration(s, prof));
      newBuffer = Math.max(newBuffer, s.bufferMinutes || 0);
    });
    // servicos na ordem escolhida, para calcular os segmentos de ocupacao
    const orderedServices = ids
      .map((id) => svcById.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const duration = ids.reduce((sum, id) => sum + (durById.get(id) || 0), 0);
    if (duration <= 0) {
      res.json({ date: dateStr, slots: [] });
      return;
    }
    // deslocamento (a domicilio): ocupa antes/depois de cada horario candidato
    const travelMin = await homeTravelOneWay(req, establishmentId);

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) {
      res.status(400).json({ message: "Data invalida (use YYYY-MM-DD)" });
      return;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);

    const availability = await Availability.findOne({
      establishment: establishmentId,
      professional: prof,
    });
    if (!availability || availability.workingHours.length === 0) {
      res.json({ date: dateStr, slots: [] });
      return;
    }

    const now = new Date();
    const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);
    const dayOfWeek = localNoon.getDay();

    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

    const atMinute = (minute: number) =>
      new Date(year, month - 1, day, 0, minute, 0, 0);
    const dayStart = atMinute(0);
    const nextDayStart = new Date(dayStart.getTime() + 86400000);

    const bookingFilter: Record<string, unknown> = {
      establishment: establishmentId,
      status: { $in: ["pendente", "confirmado", "reservado"] },
      scheduledAt: { $gte: dayStart, $lt: nextDayStart },
    };
    if (prof) bookingFilter.professional = prof;
    const bookings = await Booking.find(bookingFilter);

    const blockFilter: Record<string, unknown> = {
      establishment: establishmentId,
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

    const overlaps = (
      aStart: Date,
      aEnd: Date,
      bStart: Date,
      bEnd: Date
    ): boolean => aStart < bEnd && aEnd > bStart;

    const slots: string[] = [];
    for (const block of workBlocks) {
      for (
        let min = block.startMinute;
        min + duration <= block.endMinute;
        min += SLOT_STEP
      ) {
        const slotStart = atMinute(min);
        const slotEnd = atMinute(min + duration);
        if (slotStart < minStart) continue;
        if (
          dayBreaks.some((br) =>
            overlaps(
              slotStart,
              slotEnd,
              atMinute(br.startMinute),
              atMinute(br.endMinute)
            )
          )
        )
          continue;
        if (dayBlocks.some((blk) => overlaps(slotStart, slotEnd, blk.startAt, blk.endAt)))
          continue;
        // conflito por SEGMENTOS (pausa de processamento nao ocupa)
        const candSegs = computeBusySegments(
          orderedServices,
          slotStart,
          prof,
          newBuffer,
          travelMin,
          travelMin
        );
        if (bookings.some((b) => segmentsOverlap(candSegs, bookingSegments(b))))
          continue;
        slots.push(slotStart.toISOString());
      }
    }

    res.json({ date: dateStr, slots });
  } catch (err) {
    console.error("getComboSlots:", err);
    res.status(500).json({ message: "Erro ao calcular horarios do combo" });
  }
};