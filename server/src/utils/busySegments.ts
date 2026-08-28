import { Types } from "mongoose";
import { effectiveDuration } from "../models/Service";

// Um segmento de OCUPACAO (o profissional esta ocupado neste intervalo).
export interface Segment {
  start: Date;
  end: Date;
}

const MIN = 60000;

// Formato minimo de servico que o calculo precisa.
export interface ServiceLike {
  durationMinutes: number;
  processingGapAfter?: number;
  processingGapMinutes?: number;
  bufferMinutes?: number;
  professionalDurations?: {
    professional: Types.ObjectId;
    durationMinutes: number;
  }[];
}

// Calcula os segmentos de ocupacao de um atendimento (um ou mais servicos, na
// ordem) a partir de um horario de inicio, para um profissional.
// - um servico com pausa de processamento gera DOIS segmentos (antes e depois
//   da pausa); a pausa NAO ocupa o profissional (fica livre).
// - servicos sem pausa geram um segmento (duracao efetiva do profissional).
// - `bufferMinutes` (folga apos o atendimento) estende o fim do ultimo segmento.
// - `travelBefore`/`travelAfter` (deslocamento a domicilio, ida/volta em min)
//   ocupam o profissional ANTES do inicio e DEPOIS do fim: ele sai antes e
//   volta depois, entao nao pode atender outro cliente nesse intervalo.
export function computeBusySegments(
  services: ServiceLike[],
  start: Date,
  prof: Types.ObjectId | string | null,
  bufferMinutes = 0,
  travelBefore = 0,
  travelAfter = 0
): Segment[] {
  const segs: Segment[] = [];
  let cursor = start.getTime();

  // deslocamento de ida: ocupa [inicio - ida, inicio]
  if (travelBefore > 0) {
    segs.push({
      start: new Date(cursor - travelBefore * MIN),
      end: new Date(cursor),
    });
  }

  for (const s of services) {
    const gapAfter = s.processingGapAfter || 0;
    const gapMin = s.processingGapMinutes || 0;
    const total = s.durationMinutes;

    const hasGap = gapMin > 0 && gapAfter > 0 && gapAfter + gapMin < total;
    if (hasGap) {
      // trabalho ativo antes da pausa
      segs.push({
        start: new Date(cursor),
        end: new Date(cursor + gapAfter * MIN),
      });
      // pausa: profissional livre (nao gera segmento)
      const resume = cursor + (gapAfter + gapMin) * MIN;
      const after = total - gapAfter - gapMin;
      if (after > 0) {
        segs.push({
          start: new Date(resume),
          end: new Date(resume + after * MIN),
        });
      }
      cursor += total * MIN;
    } else {
      const dur = effectiveDuration(s, prof);
      segs.push({ start: new Date(cursor), end: new Date(cursor + dur * MIN) });
      cursor += dur * MIN;
    }
  }

  // folga apos o atendimento + deslocamento de volta estendem o ultimo segmento
  const tail = bufferMinutes + travelAfter;
  if (tail > 0 && segs.length > 0) {
    const last = segs[segs.length - 1];
    last.end = new Date(last.end.getTime() + tail * MIN);
  }

  return segs;
}

// Segmentos de ocupacao de um agendamento EXISTENTE. Usa os salvos; para
// agendamentos antigos (sem busySegments), cai no bloco [scheduledAt, endsAt]
// estendido pela folga (comportamento anterior).
export function bookingSegments(booking: {
  scheduledAt: Date;
  endsAt: Date;
  bufferMinutes?: number;
  busySegments?: { start: Date; end: Date }[];
}): Segment[] {
  if (booking.busySegments && booking.busySegments.length > 0) {
    return booking.busySegments.map((s) => ({
      start: new Date(s.start),
      end: new Date(s.end),
    }));
  }
  const end = new Date(
    booking.endsAt.getTime() + (booking.bufferMinutes || 0) * MIN
  );
  return [{ start: new Date(booking.scheduledAt), end }];
}

const rangesOverlap = (a: Segment, b: Segment): boolean =>
  a.start < b.end && a.end > b.start;

// true se QUALQUER segmento de A sobrepoe QUALQUER segmento de B.
export function segmentsOverlap(a: Segment[], b: Segment[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (rangesOverlap(x, y)) return true;
    }
  }
  return false;
}
