import { Response } from "express";
import { Types } from "mongoose";
import {
  ConstructionProject,
  ProjectStatus,
  projectExecuted,
} from "../models/ConstructionProject";
import { Establishment } from "../models/Establishment";
import { Service, depositFor, effectiveDuration } from "../models/Service";
import { Booking } from "../models/Booking";
import { CashSession } from "../models/CashSession";
import { CashMovement } from "../models/CashMovement";
import { AuthRequest } from "../middleware/auth";
import { assertSlotIsBookable } from "../utils/slotValidation";
import { professionalDoesService } from "../utils/serviceProfessional";
import { establishmentRecipients } from "../utils/notify";
import { getIO } from "../socket";

const BUSY_STATUSES = ["pendente", "confirmado", "reservado"];
const CASH_METHODS = ["dinheiro", "cartao", "pix", "outro"];

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
const clampNum = (v: unknown): number => Math.max(0, Number(v) || 0);
const objId = (v: unknown): Types.ObjectId | null =>
  typeof v === "string" && Types.ObjectId.isValid(v)
    ? new Types.ObjectId(v)
    : null;

const STATUSES: ProjectStatus[] = [
  "orcamento",
  "em_andamento",
  "concluida",
  "cancelada",
];
const sanitizeStatus = (v: unknown): ProjectStatus =>
  STATUSES.includes(v as ProjectStatus)
    ? (v as ProjectStatus)
    : "orcamento";

const FREQUENCIES = [
  "diaria",
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "personalizada",
];
const sanitizeFrequency = (v: unknown): string =>
  FREQUENCIES.includes(String(v)) ? String(v) : "mensal";
const sanitizePay = (v: unknown) =>
  CASH_METHODS.includes(String(v))
    ? (String(v) as "dinheiro" | "cartao" | "pix" | "outro")
    : "pix";

// etapas do orcamento
const sanitizeStages = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((e) => {
          const it = (e || {}) as Record<string, unknown>;
          return {
            name: cleanText(it.name),
            value: clampNum(it.value),
            progress: Math.min(100, Math.max(0, Math.floor(Number(it.progress) || 0))),
          };
        })
        .filter((e) => e.name !== "" || e.value > 0)
    : [];

// payload comum de create/update. NAO mexe em measurements nem seriesId
// (geridos pelos endpoints de medicao e agenda).
const buildPayload = (body: Record<string, unknown>) => ({
  client: objId(body.client),
  clientName: cleanText(body.clientName),
  clientPhone: cleanText(body.clientPhone),
  title: cleanText(body.title),
  location: cleanText(body.location),
  status: sanitizeStatus(body.status),
  stages: sanitizeStages(body.stages),
  service: objId(body.service),
  professional: objId(body.professional),
  startDate: cleanText(body.startDate),
  time: cleanText(body.time),
  frequency: sanitizeFrequency(body.frequency),
  visitsCount: Math.min(53, Math.max(1, Math.floor(Number(body.visitsCount) || 4))),
  notes: cleanText(body.notes),
});

const todayYMD = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

// cria UMA entrada no caixa aberto (respeita o auto-lancamento). true = lancou.
async function postCash(
  establishmentId: Types.ObjectId | string,
  userId: string | undefined,
  amount: number,
  method: string,
  description: string
): Promise<boolean> {
  if (!(amount > 0)) return false;
  const est = await Establishment.findById(establishmentId).select(
    "cashAutoEntry"
  );
  if (est?.cashAutoEntry === false) return false;
  const session = await CashSession.findOne({
    establishment: establishmentId,
    status: "aberto",
  });
  if (!session) return false;
  const m = CASH_METHODS.includes(method) ? method : "dinheiro";
  await CashMovement.create({
    session: session._id,
    establishment: establishmentId,
    createdBy: userId,
    type: "entrada",
    method: m,
    amount,
    description,
    professional: null,
  });
  return true;
}

// GET /api/construction-projects/:establishmentId
export const listProjects = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await ConstructionProject.find({
      establishment: establishmentId,
    })
      .sort({ number: -1, updatedAt: -1 })
      .limit(300);
    res.json(items);
  } catch (err) {
    console.error("listProjects:", err);
    res.status(500).json({ message: "Erro ao listar obras" });
  }
};

// POST /api/construction-projects/:establishmentId
export const createProject = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const last = await ConstructionProject.findOne({
      establishment: establishmentId,
    })
      .sort({ number: -1 })
      .select("number");
    const number = (last?.number || 0) + 1;
    const project = await ConstructionProject.create({
      establishment: establishmentId,
      number,
      author: req.userId,
      ...buildPayload(req.body),
    });
    res.status(201).json(project);
  } catch (err) {
    console.error("createProject:", err);
    res.status(500).json({ message: "Erro ao criar obra" });
  }
};

// PUT /api/construction-projects/:establishmentId/:id
export const updateProject = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const project = await ConstructionProject.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!project) {
      res.status(404).json({ message: "Obra nao encontrada" });
      return;
    }
    Object.assign(project, buildPayload(req.body));
    await project.save();
    res.json(project);
  } catch (err) {
    console.error("updateProject:", err);
    res.status(500).json({ message: "Erro ao atualizar obra" });
  }
};

// POST /api/construction-projects/:establishmentId/:id/measurement
// Cria uma medicao (boletim). O valor e informado OU calculado pelo avanco:
// executado (soma valor*avanco das etapas) menos o ja faturado. Lanca no caixa.
export const addMeasurement = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const project = await ConstructionProject.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!project) {
      res.status(404).json({ message: "Obra nao encontrada" });
      return;
    }

    const executed = projectExecuted(project.stages);
    const billed = project.measurements.reduce(
      (s, m) => s + (Number(m.amount) || 0),
      0
    );
    const provided = clampNum(req.body.amount);
    const amount =
      provided > 0
        ? Math.round(provided * 100) / 100
        : Math.round(Math.max(0, executed - billed) * 100) / 100;
    if (!(amount > 0)) {
      res.status(400).json({
        message: "Nada a medir: sem avanco novo desde a ultima medicao",
      });
      return;
    }

    const method = sanitizePay(req.body.method);
    project.measurements.push({
      date: cleanText(req.body.date) || todayYMD(),
      note: cleanText(req.body.note),
      amount,
      method,
      postedToCash: false,
      createdAt: new Date(),
    });
    const idx = project.measurements.length - 1;

    const posted = await postCash(
      establishmentId,
      req.userId,
      amount,
      method,
      `Obra #${project.number}${
        project.title ? " - " + project.title : ""
      } - Medicao ${idx + 1}`
    );
    if (posted) project.measurements[idx].postedToCash = true;

    await project.save();
    res.status(201).json(project);
  } catch (err) {
    console.error("addMeasurement:", err);
    res.status(500).json({ message: "Erro ao registrar medicao" });
  }
};

// POST /api/construction-projects/:establishmentId/:id/schedule
// Gera visitas de acompanhamento na agenda (bookings recorrentes confirmados).
export const scheduleVisits = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const project = await ConstructionProject.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!project) {
      res.status(404).json({ message: "Obra nao encontrada" });
      return;
    }
    if (project.seriesId) {
      res.status(409).json({
        message: "Obra ja tem visitas na agenda. Cancele a serie antes.",
      });
      return;
    }
    if (!project.client) {
      res.status(400).json({ message: "Escolha um cliente cadastrado." });
      return;
    }
    if (!project.service) {
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
    const service = await Service.findById(project.service);
    if (!service || service.establishment.toString() !== establishmentId) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }

    const prof = project.professional
      ? new Types.ObjectId(String(project.professional))
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
    const notes = cleanText(req.body.notes) || cleanText(project.notes);
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
        client: project.client,
        establishment: service.establishment,
        owner: est.owner,
        service: service._id,
        professional: prof,
        seriesId,
        scheduledAt: start,
        endsAt: end,
        status: "confirmado",
        notes,
        address: project.location || undefined,
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

    project.seriesId = seriesId;
    await project.save();

    const recipients = await establishmentRecipients(service.establishment, prof);
    const io = getIO();
    for (const uid of recipients) {
      io.to(`user:${uid}`).emit("booking:new", created[0]);
    }

    res.status(201).json({
      project,
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

// POST /api/construction-projects/:establishmentId/:id/unschedule
export const unscheduleVisits = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const project = await ConstructionProject.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!project) {
      res.status(404).json({ message: "Obra nao encontrada" });
      return;
    }
    if (project.seriesId) {
      await Booking.updateMany(
        {
          seriesId: project.seriesId,
          establishment: establishmentId,
          scheduledAt: { $gte: new Date() },
          status: { $ne: "cancelado" },
        },
        { status: "cancelado" }
      );
      project.seriesId = null;
      await project.save();
    }
    res.json(project);
  } catch (err) {
    console.error("unscheduleVisits:", err);
    res.status(500).json({ message: "Erro ao cancelar visitas" });
  }
};

// DELETE /api/construction-projects/:establishmentId/:id
export const deleteProject = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const project = await ConstructionProject.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!project) {
      res.status(404).json({ message: "Obra nao encontrada" });
      return;
    }
    if (project.seriesId) {
      await Booking.updateMany(
        {
          seriesId: project.seriesId,
          establishment: establishmentId,
          scheduledAt: { $gte: new Date() },
          status: { $ne: "cancelado" },
        },
        { status: "cancelado" }
      );
    }
    await project.deleteOne();
    res.json({ message: "Obra removida", _id: id });
  } catch (err) {
    console.error("deleteProject:", err);
    res.status(500).json({ message: "Erro ao remover obra" });
  }
};
