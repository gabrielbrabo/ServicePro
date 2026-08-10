import { Response } from "express";
import { Waitlist } from "../models/Waitlist";
import { Service } from "../models/Service";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import { Types } from "mongoose";

const parseTargetDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
};

const parseProfessional = (value: unknown): Types.ObjectId | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

// POST /api/waitlist  (protegido) - cliente entra na fila
// body: { serviceId, targetDate? ("YYYY-MM-DD"), professionalId? }
export const joinWaitlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { serviceId, targetDate, professionalId } = req.body;

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

    const parsedDate = parseTargetDate(targetDate);
    const prof = parseProfessional(professionalId);

    // se veio profissional, valida que existe e esta ativo
    if (prof) {
      const exists = establishment.professionals.some(
        (p) => p.active && p._id.toString() === prof.toString()
      );
      if (!exists) {
        res
          .status(404)
          .json({ message: "Profissional nao encontrado ou inativo" });
        return;
      }
    }

    // ja esta na fila para este servico+profissional+dia?
    const existing = await Waitlist.findOne({
      client: req.userId,
      service: service._id,
      professional: prof,
      targetDate: parsedDate,
      status: { $in: ["aguardando", "notificado"] },
    });
    if (existing) {
      res.status(409).json({ message: "Voce ja esta nesta lista de espera" });
      return;
    }

    const entry = await Waitlist.create({
      client: req.userId,
      establishment: service.establishment,
      owner: establishment.owner,
      service: service._id,
      professional: prof,
      targetDate: parsedDate,
      status: "aguardando",
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error("joinWaitlist:", err);
    res.status(500).json({ message: "Erro ao entrar na lista de espera" });
  }
};

// GET /api/waitlist  (protegido)
export const listWaitlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const role = req.query.role === "provider" ? "provider" : "client";
    const establishment = req.query.establishment as string | undefined;

    const filter: Record<string, unknown> =
      role === "provider" ? { owner: req.userId } : { client: req.userId };

    if (role === "provider" && establishment) {
      filter.establishment = establishment;
    }

    filter.status = { $in: ["aguardando", "notificado"] };

    const entries = await Waitlist.find(filter)
      .populate("service", "title price durationMinutes")
      .populate("client", "name avatar")
      .populate("establishment", "name professionals")
      .sort({ createdAt: 1 });

    res.json(entries);
  } catch (err) {
    console.error("listWaitlist:", err);
    res.status(500).json({ message: "Erro ao listar lista de espera" });
  }
};

// DELETE /api/waitlist/:id  (protegido) - sair da fila
export const leaveWaitlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const entry = await Waitlist.findById(req.params.id);
    if (!entry) {
      res.status(404).json({ message: "Entrada nao encontrada" });
      return;
    }

    const isOwner = entry.owner.toString() === req.userId;
    const isClient = entry.client.toString() === req.userId;
    if (!isOwner && !isClient) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    entry.status = "cancelado";
    await entry.save();

    res.json({ message: "Removido da lista de espera", _id: entry._id });
  } catch (err) {
    console.error("leaveWaitlist:", err);
    res.status(500).json({ message: "Erro ao sair da lista de espera" });
  }
};