import { Response } from "express";
import { Types } from "mongoose";
import { MassageAssessment } from "../models/MassageAssessment";
import { MassageSession } from "../models/MassageSession";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";

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

const clientHasBooking = async (
  establishmentId: string,
  clientId: string
): Promise<boolean> => {
  const b = await Booking.findOne({
    establishment: establishmentId,
    client: clientId,
  }).select("_id");
  return !!b;
};

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

const parseEva = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  if (isNaN(n)) return null;
  return Math.min(10, Math.max(0, n));
};

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

// ============ AVALIACAO ============

// GET /api/beauty-massage/:establishmentId/:clientId/assessment
export const getAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const a = await MassageAssessment.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!a) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        mainComplaint: "",
        tensionPoints: "",
        contraindications: "",
        goals: "",
        observations: "",
        _isNew: true,
      });
      return;
    }
    res.json(a);
  } catch (err) {
    console.error("getAssessment(massage):", err);
    res.status(500).json({ message: "Erro ao buscar avaliacao" });
  }
};

// PUT /api/beauty-massage/:establishmentId/:clientId/assessment
export const updateAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este cliente nao tem atendimentos no estabelecimento",
      });
      return;
    }
    const update: Record<string, unknown> = { updatedBy: req.userId };
    for (const f of [
      "mainComplaint",
      "tensionPoints",
      "contraindications",
      "goals",
      "observations",
    ]) {
      if (typeof req.body[f] === "string") update[f] = cleanText(req.body[f]);
    }
    const a = await MassageAssessment.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      {
        $set: update,
        $setOnInsert: { establishment: establishmentId, client: clientId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(a);
  } catch (err) {
    console.error("updateAssessment(massage):", err);
    res.status(500).json({ message: "Erro ao salvar avaliacao" });
  }
};

// ============ SESSOES ============

// GET /api/beauty-massage/:establishmentId/:clientId/sessions
export const listSessions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await MassageSession.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listSessions(massage):", err);
    res.status(500).json({ message: "Erro ao listar sessoes" });
  }
};

// POST /api/beauty-massage/:establishmentId/:clientId/sessions
export const addSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este cliente nao tem atendimentos no estabelecimento",
      });
      return;
    }
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    const item = await MassageSession.create({
      establishment: establishmentId,
      client: clientId,
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      technique: cleanText(req.body.technique),
      regions: cleanText(req.body.regions),
      evolution: cleanText(req.body.evolution),
      painBefore: parseEva(req.body.painBefore),
      painAfter: parseEva(req.body.painAfter),
      author: req.userId,
    });
    const populated = await item.populate("author", "name");
    res.status(201).json(populated);
  } catch (err) {
    console.error("addSession(massage):", err);
    res.status(500).json({ message: "Erro ao registrar sessao" });
  }
};

// DELETE /api/beauty-massage/:establishmentId/:clientId/sessions/:sessionId
export const deleteSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, sessionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!Types.ObjectId.isValid(sessionId)) {
      res.status(404).json({ message: "Sessao nao encontrada" });
      return;
    }
    const deleted = await MassageSession.findOneAndDelete({
      _id: sessionId,
      establishment: establishmentId,
      client: clientId,
    });
    if (!deleted) {
      res.status(404).json({ message: "Sessao nao encontrada" });
      return;
    }
    res.json({ message: "Sessao removida", _id: sessionId });
  } catch (err) {
    console.error("deleteSession(massage):", err);
    res.status(500).json({ message: "Erro ao remover sessao" });
  }
};
