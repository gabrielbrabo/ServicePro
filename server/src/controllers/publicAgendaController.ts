import { Request, Response } from "express";
import { Types } from "mongoose";
import { Availability, IAvailability } from "../models/Availability";
import { Booking } from "../models/Booking";
import { Establishment } from "../models/Establishment";
import { TimeBlock } from "../models/TimeBlock";
import { Service } from "../models/Service";

// ---------------------------------------------------------------------------
// Agenda PUBLICA de divulgacao (sem login). Devolve, para cada dia do mes, os
// HORARIOS reais do expediente marcados como LIVRE ou OCUPADO, para montar a
// pagina publica e o banner compartilhavel nas redes sociais.
//
// - prof (query): id do subdoc em Establishment.professionals. Se presente, usa
//   a agenda e os agendamentos DAQUELE profissional; ausente, a agenda do
//   estabelecimento.
// - mes (query): YYYY-MM. Ausente => mes atual (fuso do servidor).
//
// Robustez do expediente:
// - prof: usa a agenda do profissional; se ele nao tiver, cai na agenda geral.
// - estabelecimento: usa a agenda geral; se nao houver, AGREGA as agendas de
//   todos os profissionais (capacidade = quantos profissionais atendem naquele
//   horario). Assim a divulgacao nao aparece vazia.
//
// Privacidade: nunca expoe cliente/servico — so o horario e se esta livre.
// ---------------------------------------------------------------------------

interface AgendaSlot {
  t: string; // "09:00"
  free: boolean;
}

interface AgendaDay {
  date: string; // YYYY-MM-DD
  dow: number; // 0=domingo ... 6=sabado
  working: boolean;
  slots: AgendaSlot[];
}

const parseProfessional = (value: unknown): Types.ObjectId | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

const pad = (n: number): string => String(n).padStart(2, "0");

// a agenda `av` cobre o bloco [startMin, endMin) do dia da semana `dow`?
// (dentro de algum workingHour e fora de qualquer break)
const covers = (
  av: IAvailability,
  dow: number,
  startMin: number,
  endMin: number
): boolean => {
  const inWork = av.workingHours.some(
    (w) => w.dayOfWeek === dow && w.startMinute <= startMin && w.endMinute >= endMin
  );
  if (!inWork) return false;
  const inBreak = av.breaks.some(
    (b) =>
      (b.dayOfWeek === null || b.dayOfWeek === dow) &&
      b.startMinute < endMin &&
      b.endMinute > startMin
  );
  return !inBreak;
};

// GET publico /api/public/agenda/:establishmentId?prof=&mes=YYYY-MM
export const getPublicAgenda = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!Types.ObjectId.isValid(establishmentId)) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    const est = await Establishment.findById(establishmentId).select(
      "name photo professionals"
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    const prof = parseProfessional(req.query.prof);
    let professionalName: string | null = null;
    // foto exibida no banner/pagina: a do profissional (se houver) ou a do estab.
    let photo: string = est.photo || "";
    if (prof) {
      const sub = est.professionals.id(prof);
      if (!sub) {
        res
          .status(404)
          .json({ message: "Profissional nao encontrado no estabelecimento" });
        return;
      }
      professionalName = sub.name;
      if (sub.photo) photo = sub.photo;
    }

    // mes pedido (YYYY-MM); padrao = mes atual no fuso do servidor
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    const mm = /^(\d{4})-(\d{2})$/.exec(String(req.query.mes || ""));
    if (mm) {
      year = Number(mm[1]);
      month = Number(mm[2]);
      if (month < 1 || month > 12) {
        res.status(400).json({ message: "Mes invalido (use YYYY-MM)" });
        return;
      }
    }
    const monthStr = `${year}-${pad(month)}`;

    // ---- monta o conjunto de agendas que definem a capacidade ----
    let agendas: IAvailability[] = [];
    if (prof) {
      const own = await Availability.findOne({
        establishment: establishmentId,
        professional: prof,
      });
      if (own && own.workingHours.length > 0) {
        agendas = [own];
      } else {
        const general = await Availability.findOne({
          establishment: establishmentId,
          professional: null,
        });
        if (general && general.workingHours.length > 0) agendas = [general];
      }
    } else {
      // agenda do estabelecimento = UNIAO de todos os expedientes (o geral e o
      // de cada profissional). Assim mostramos todos os horarios em que ALGUEM
      // atende, sem depender de qual doc guarda o expediente.
      const all = await Availability.find({ establishment: establishmentId });
      agendas = all.filter((a) => a.workingHours.length > 0);
    }

    const emptyResp = {
      establishmentName: est.name,
      professionalName,
      photo,
      month: monthStr,
      days: [] as AgendaDay[],
    };
    if (agendas.length === 0) {
      res.json(emptyResp);
      return;
    }

    // limites do mes (horario local)
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 1, 0, 0, 0, 0);
    const daysInMonth = new Date(year, month, 0).getDate();

    // agendamentos do mes (do profissional, se houver; senao do estabelecimento)
    const bookingFilter: Record<string, unknown> = {
      establishment: establishmentId,
      status: { $in: ["pendente", "confirmado", "reservado"] },
      scheduledAt: { $gte: monthStart, $lt: monthEnd },
    };
    if (prof) bookingFilter.professional = prof;
    const bookings = await Booking.find(bookingFilter).select(
      "scheduledAt endsAt busySegments"
    );

    // bloqueios que tocam o mes
    const blockFilter: Record<string, unknown> = {
      establishment: establishmentId,
      startAt: { $lt: monthEnd },
      endAt: { $gt: monthStart },
    };
    if (prof) {
      blockFilter.$or = [{ professional: null }, { professional: prof }];
    } else {
      blockFilter.professional = null;
    }
    const blocks = await TimeBlock.find(blockFilter).select("startAt endAt");

    const overlaps = (
      aStart: Date,
      aEnd: Date,
      bStart: Date,
      bEnd: Date
    ): boolean => aStart < bEnd && aEnd > bStart;

    const bookingBusy = (b: (typeof bookings)[number]): [Date, Date][] => {
      if (b.busySegments && b.busySegments.length > 0) {
        return b.busySegments.map((s) => [s.start, s.end] as [Date, Date]);
      }
      return [[b.scheduledAt, b.endsAt] as [Date, Date]];
    };

    // passo da grade = MEDIA da duracao dos servicos (arredondada a 5 min, minimo
    // 15). Assim os horarios exibidos batem com a granularidade real de
    // agendamento (inclui os "picados" tipo 07:45) e um agendamento das 07:15 nao
    // marca o slot das 07:00 como ocupado indevidamente.
    const svcs = await Service.find({
      establishment: establishmentId,
    }).select("durationMinutes");
    let step = 60;
    const durs = svcs
      .map((s) => (s as unknown as { durationMinutes?: number }).durationMinutes || 0)
      .filter((d) => d > 0);
    if (durs.length > 0) {
      step = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 5) * 5;
    }
    if (!step || step < 15) step = 15;

    const days: AgendaDay[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(year, month - 1, day, 12).getDay();
      const date = `${year}-${pad(month)}-${pad(day)}`;
      const atMinute = (minute: number) =>
        new Date(year, month - 1, day, 0, minute, 0, 0);

      // janela do dia = menor inicio / maior fim entre as agendas nesse dia
      let dayStart = Infinity;
      let dayEnd = -Infinity;
      for (const av of agendas) {
        for (const wh of av.workingHours) {
          if (wh.dayOfWeek === dow) {
            dayStart = Math.min(dayStart, wh.startMinute);
            dayEnd = Math.max(dayEnd, wh.endMinute);
          }
        }
      }

      const slots: AgendaSlot[] = [];
      if (Number.isFinite(dayStart)) {
        // horarios candidatos: primeiro (dayStart), passo a passo, e o ULTIMO
        // (termina exatamente no fim do expediente) — primeiro e ultimo tem
        // prioridade e sempre aparecem.
        const starts: number[] = [];
        for (let min = dayStart; min + step <= dayEnd; min += step) starts.push(min);
        const lastStart = dayEnd - step;
        if (lastStart >= dayStart && !starts.includes(lastStart)) starts.push(lastStart);
        starts.sort((a, b) => a - b);

        for (const min of starts) {
          const end = min + step;
          // capacidade = quantas agendas atendem nesse horario (fora de pausa)
          const capacity = agendas.reduce(
            (n, av) => (covers(av, dow, min, end) ? n + 1 : n),
            0
          );
          if (capacity === 0) continue;

          const slotStart = atMinute(min);
          const slotEnd = atMinute(end);

          if (slotStart <= now) continue; // ja passou
          if (blocks.some((blk) => overlaps(slotStart, slotEnd, blk.startAt, blk.endAt)))
            continue; // bloqueio pontual

          const busyCount = bookings.reduce(
            (n, b) =>
              bookingBusy(b).some(([bs, be]) => overlaps(slotStart, slotEnd, bs, be))
                ? n + 1
                : n,
            0
          );

          slots.push({
            t: `${pad(Math.floor(min / 60))}:${pad(min % 60)}`,
            free: busyCount < capacity,
          });
        }
      }

      days.push({ date, dow, working: slots.length > 0, slots });
    }

    res.json({
      establishmentName: est.name,
      professionalName,
      photo,
      month: monthStr,
      days,
    });
  } catch (err) {
    console.error("getPublicAgenda:", err);
    res.status(500).json({ message: "Erro ao carregar a agenda" });
  }
};

// GET publico /api/public/agenda/:establishmentId/photo?prof=
// Reserva a foto (do profissional ou do estabelecimento) pelo backend para o
// banner poder desenha-la no canvas sem esbarrar no CORS do S3.
export const getPublicAgendaPhoto = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!Types.ObjectId.isValid(establishmentId)) {
      res.status(404).end();
      return;
    }
    const est = await Establishment.findById(establishmentId).select(
      "photo professionals"
    );
    if (!est) {
      res.status(404).end();
      return;
    }
    const prof = parseProfessional(req.query.prof);
    let photoUrl = est.photo || "";
    if (prof) {
      const sub = est.professionals.id(prof);
      if (sub && sub.photo) photoUrl = sub.photo;
    }
    if (!photoUrl) {
      res.status(404).end();
      return;
    }
    // fetch global (Node 18+); referencia solta para nao depender dos types
    const fetchFn = (globalThis as unknown as { fetch?: (u: string) => Promise<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer>; headers: { get: (k: string) => string | null } }> }).fetch;
    if (!fetchFn) {
      res.status(404).end();
      return;
    }
    const r = await fetchFn(photoUrl);
    if (!r.ok) {
      res.status(404).end();
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=300");
    res.send(buf);
  } catch (err) {
    console.error("getPublicAgendaPhoto:", err);
    res.status(404).end();
  }
};
