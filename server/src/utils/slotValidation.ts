import { Availability } from "../models/Availability";
import { TimeBlock } from "../models/TimeBlock";
import { Types } from "mongoose";

export interface SlotCheckResult {
  ok: boolean;
  reason?: string;
}

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart < bEnd && aEnd > bStart;

// Valida se [start, end) e agendavel.
// professional (opcional): se informado, usa a agenda e os bloqueios daquele
// profissional (mais os bloqueios gerais do estabelecimento). Se ausente, usa
// a agenda geral (professional=null) — comportamento original.
export const assertSlotIsBookable = async (
  establishmentId: Types.ObjectId | string,
  start: Date,
  end: Date,
  professional?: Types.ObjectId | string | null
): Promise<SlotCheckResult> => {
  const prof =
    professional && Types.ObjectId.isValid(String(professional))
      ? new Types.ObjectId(String(professional))
      : null;

  const availability = await Availability.findOne({
    establishment: establishmentId,
    professional: prof,
  });

  if (!availability || availability.workingHours.length === 0) {
    return { ok: false, reason: "Sem horarios configurados para este atendimento" };
  }

  const now = new Date();
  const minStart = new Date(
    now.getTime() + availability.minAdvanceMinutes * 60000
  );
  if (start < minStart) {
    return { ok: false, reason: "Horario abaixo da antecedencia minima" };
  }

  const localNoon = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    12,
    0,
    0,
    0
  );
  const dayOfWeek = localNoon.getDay();

  const dayMidnight = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    0,
    0,
    0,
    0
  );
  const startMin = Math.round((start.getTime() - dayMidnight.getTime()) / 60000);
  const endMin = Math.round((end.getTime() - dayMidnight.getTime()) / 60000);

  const dentroDoExpediente = availability.workingHours.some(
    (w) => w.dayOfWeek === dayOfWeek && startMin >= w.startMinute && endMin <= w.endMinute
  );
  if (!dentroDoExpediente) {
    return { ok: false, reason: "Fora do horario de funcionamento" };
  }

  const atMinute = (minute: number) =>
    new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      0,
      minute,
      0,
      0
    );
  const emBreak = availability.breaks
    .filter((b) => b.dayOfWeek === null || b.dayOfWeek === dayOfWeek)
    .some((br) =>
      overlaps(start, end, atMinute(br.startMinute), atMinute(br.endMinute))
    );
  if (emBreak) {
    return { ok: false, reason: "Horario dentro de um intervalo (break)" };
  }

  // bloqueios: os gerais (professional=null) sempre; os do profissional, se houver
  const blockFilter: Record<string, unknown> = {
    establishment: establishmentId,
    startAt: { $lt: end },
    endAt: { $gt: start },
  };
  if (prof) {
    blockFilter.$or = [{ professional: null }, { professional: prof }];
  } else {
    blockFilter.professional = null;
  }
  const bloqueio = await TimeBlock.findOne(blockFilter);
  if (bloqueio) {
    return { ok: false, reason: "Horario bloqueado" };
  }

  return { ok: true };
};