import { Response } from "express";
import { Types } from "mongoose";
import { MaintenancePlan } from "../models/MaintenancePlan";
import { Establishment } from "../models/Establishment";
import { Service, depositFor, effectiveDuration } from "../models/Service";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";
import { assertSlotIsBookable } from "../utils/slotValidation";
import { professionalDoesService } from "../utils/serviceProfessional";
import { establishmentRecipients } from "../utils/notify";
import { getIO } from "../socket";

const BUSY_STATUSES = ["pendente", "confirmado", "reservado"];

const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  }).select("_id");
  return !!est;
};

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";
const objId = (v: unknown): Types.ObjectId | null =>
  typeof v === "string" && Types.ObjectId.isValid(v)
    ? new Types.ObjectId(v)
    : null;

const FREQUENCIES = [
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "personalizada",
];
const sanitizeFrequency = (v: unknown): string =>
  FREQUENCIES.includes(String(v)) ? String(v) : "mensal";

// escopo do plano (tarefas recorrentes)
const sanitizeTasks = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((t) => ({ name: cleanText((t as { name?: unknown })?.name) }))
        .filter((t) => t.name !== "")
    : [];

// payload comum de create/update. NAO mexe em seriesId (gerido pelo
// agendamento/cancelamento das visitas).
const buildPayload = (body: Record<string, unknown>) => ({
  client: objId(body.client),
  clientName: cleanText(body.clientName),
  clientPhone: cleanText(body.clientPhone),
  location: cleanText(body.location),
  frequency: sanitizeFrequency(body.frequency),
  frequencyNote: cleanText(body.frequencyNote),
  active: body.active === undefined ? true : !!body.active,
  service: objId(body.service),
  professional: objId(body.professional),
  startDate: cleanText(body.startDate),
  time: cleanText(body.time),
  visitsCount: Math.min(53, Math.max(1, Math.floor(Number(body.visitsCount) || 4))),
  tasks: sanitizeTasks(body.tasks),
  notes: cleanText(body.notes),
});

// GET /api/maintenance-plans/:establishmentId
export const listPlans = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await MaintenancePlan.find({
      establishment: establishmentId,
    }).sort({ active: -1, updatedAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listPlans:", err);
    res.status(500).json({ message: "Erro ao listar planos de manutencao" });
  }
};

// POST /api/maintenance-plans/:establishmentId
export const createPlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const plan = await MaintenancePlan.create({
      establishment: establishmentId,
      author: req.userId,
      ...buildPayload(req.body),
    });
    res.status(201).json(plan);
  } catch (err) {
    console.error("createPlan:", err);
    res.status(500).json({ message: "Erro ao criar plano de manutencao" });
  }
};

// PUT /api/maintenance-plans/:establishmentId/:id
export const updatePlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const plan = await MaintenancePlan.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    Object.assign(plan, buildPayload(req.body));
    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error("updatePlan:", err);
    res.status(500).json({ message: "Erro ao atualizar plano de manutencao" });
  }
};

// POST /api/maintenance-plans/:establishmentId/:id/schedule
// Gera as visitas na agenda (bookings recorrentes confirmados). Os horarios
// (`slots`, ISO[]) sao calculados no cliente pela frequencia; o servidor valida
// disponibilidade e cria um booking por horario, agrupados num seriesId.
export const scheduleVisits = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const plan = await MaintenancePlan.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    if (plan.seriesId) {
      res.status(409).json({
        message: "Plano ja tem visitas na agenda. Cancele a serie antes.",
      });
      return;
    }
    if (!plan.client) {
      res.status(400).json({ message: "Escolha um cliente cadastrado." });
      return;
    }
    if (!plan.service) {
      res.status(400).json({ message: "Escolha um servico para as visitas." });
      return;
    }

    const est = await Establishment.findById(establishmentId).select(
      "owner professionals"
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    const service = await Service.findById(plan.service);
    if (!service || service.establishment.toString() !== establishmentId) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }

    const prof = plan.professional
      ? new Types.ObjectId(String(plan.professional))
      : null;
    const activePros = est.professionals.filter((p) => p.active);
    if (activePros.length > 0 && !prof) {
      res.status(400).json({ message: "Escolha um profissional" });
      return;
    }
    if (prof && !activePros.some((p) => p._id.toString() === prof.toString())) {
      res.status(404).json({ message: "Profissional nao encontrado ou inativo" });
      return;
    }
    if (!professionalDoesService(service.professionals, prof)) {
      res
        .status(400)
        .json({ message: "Este profissional nao realiza o servico escolhido" });
      return;
    }

    const raw = req.body.slots;
    const starts = (Array.isArray(raw) ? raw : [])
      .map((s) => new Date(String(s)))
      .filter((d) => !isNaN(d.getTime()));
    if (starts.length === 0 || starts.length > 60) {
      res.status(400).json({ message: "Informe de 1 a 60 datas de visita" });
      return;
    }

    const duration = effectiveDuration(service, prof);
    const seriesId = new Types.ObjectId();
    const notes = cleanText(req.body.notes) || cleanText(plan.notes);
    const created: unknown[] = [];
    const skipped: { date: string; reason: string }[] = [];

    for (const start of starts) {
      const end = new Date(start);
      end.setUTCMinutes(end.getUTCMinutes() + duration);

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
        skipped.push({ date: start.toISOString(), reason: "Horario ja ocupado" });
        continue;
      }

      const booking = await Booking.create({
        client: plan.client,
        establishment: service.establishment,
        owner: est.owner,
        service: service._id,
        professional: prof,
        seriesId,
        scheduledAt: start,
        endsAt: end,
        status: "confirmado", // agendado pelo estabelecimento ja entra confirmado
        notes,
        address: plan.location || undefined,
        payment: {
          status: "pendente",
          amount: service.price,
          depositRequired: depositFor(service),
          depositPaid: false,
        },
      });
      created.push(booking);
    }

    if (created.length === 0) {
      res.status(409).json({
        message: "Nenhuma data esta disponivel na agenda",
        created: [],
        skipped,
      });
      return;
    }

    plan.seriesId = seriesId;
    await plan.save();

    const recipients = await establishmentRecipients(service.establishment, prof);
    const io = getIO();
    for (const uid of recipients) {
      io.to(`user:${uid}`).emit("booking:new", created[0]);
    }

    res.status(201).json({
      plan,
      seriesId: seriesId.toString(),
      createdCount: created.length,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (err) {
    console.error("scheduleVisits:", err);
    res.status(500).json({ message: "Erro ao gerar visitas na agenda" });
  }
};

// POST /api/maintenance-plans/:establishmentId/:id/unschedule
// Cancela as visitas FUTURAS da serie (mantem o historico das passadas) e
// desvincula o plano, liberando um novo agendamento.
export const unscheduleVisits = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const plan = await MaintenancePlan.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    if (plan.seriesId) {
      await Booking.updateMany(
        {
          seriesId: plan.seriesId,
          establishment: establishmentId,
          scheduledAt: { $gte: new Date() },
          status: { $ne: "cancelado" },
        },
        { status: "cancelado" }
      );
      plan.seriesId = null;
      await plan.save();
    }
    res.json(plan);
  } catch (err) {
    console.error("unscheduleVisits:", err);
    res.status(500).json({ message: "Erro ao cancelar visitas" });
  }
};

// DELETE /api/maintenance-plans/:establishmentId/:id
export const deletePlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    // cancela visitas futuras da serie antes de remover o plano
    const plan = await MaintenancePlan.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    if (plan.seriesId) {
      await Booking.updateMany(
        {
          seriesId: plan.seriesId,
          establishment: establishmentId,
          scheduledAt: { $gte: new Date() },
          status: { $ne: "cancelado" },
        },
        { status: "cancelado" }
      );
    }
    await plan.deleteOne();
    res.json({ message: "Plano removido", _id: id });
  } catch (err) {
    console.error("deletePlan:", err);
    res.status(500).json({ message: "Erro ao remover plano de manutencao" });
  }
};
