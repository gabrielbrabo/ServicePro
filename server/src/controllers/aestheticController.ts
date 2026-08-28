import { Response } from "express";
import { Types } from "mongoose";
import { AestheticAssessment } from "../models/AestheticAssessment";
import { AestheticApplication } from "../models/AestheticApplication";
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

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

// ============ AVALIACAO ============

// GET /api/beauty-aesthetic/:establishmentId/:clientId/assessment
export const getAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const a = await AestheticAssessment.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!a) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        fitzpatrick: 0,
        skinType: "",
        mainComplaint: "",
        goals: "",
        contraindications: "",
        observations: "",
        _isNew: true,
      });
      return;
    }
    res.json(a);
  } catch (err) {
    console.error("getAssessment(estetica):", err);
    res.status(500).json({ message: "Erro ao buscar avaliacao" });
  }
};

// PUT /api/beauty-aesthetic/:establishmentId/:clientId/assessment
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
    if (req.body.fitzpatrick !== undefined) {
      const f = Math.round(Number(req.body.fitzpatrick));
      update.fitzpatrick = isNaN(f) ? 0 : Math.min(6, Math.max(0, f));
    }
    if (typeof req.body.skinType === "string")
      update.skinType = cleanText(req.body.skinType);
    if (typeof req.body.mainComplaint === "string")
      update.mainComplaint = cleanText(req.body.mainComplaint);
    if (typeof req.body.goals === "string")
      update.goals = cleanText(req.body.goals);
    if (typeof req.body.contraindications === "string")
      update.contraindications = cleanText(req.body.contraindications);
    if (typeof req.body.observations === "string")
      update.observations = cleanText(req.body.observations);

    const a = await AestheticAssessment.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      {
        $set: update,
        $setOnInsert: { establishment: establishmentId, client: clientId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(a);
  } catch (err) {
    console.error("updateAssessment(estetica):", err);
    res.status(500).json({ message: "Erro ao salvar avaliacao" });
  }
};

// ============ MAPA DE APLICACAO ============

// GET /api/beauty-aesthetic/:establishmentId/:clientId/applications
export const listApplications = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await AestheticApplication.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listApplications(estetica):", err);
    res.status(500).json({ message: "Erro ao listar aplicacoes" });
  }
};

// POST /api/beauty-aesthetic/:establishmentId/:clientId/applications
export const addApplication = async (
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
    const region = cleanText(req.body.region);
    if (!region) {
      res.status(400).json({ message: "Informe a regiao" });
      return;
    }
    const area = req.body.area === "corpo" ? "corpo" : "face";
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    const item = await AestheticApplication.create({
      establishment: establishmentId,
      client: clientId,
      area,
      region,
      procedure: cleanText(req.body.procedure),
      product: cleanText(req.body.product),
      amount: cleanText(req.body.amount),
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      note: cleanText(req.body.note),
      author: req.userId,
    });
    const populated = await item.populate("author", "name");
    res.status(201).json(populated);
  } catch (err) {
    console.error("addApplication(estetica):", err);
    res.status(500).json({ message: "Erro ao registrar aplicacao" });
  }
};

// DELETE /api/beauty-aesthetic/:establishmentId/:clientId/applications/:appId
export const deleteApplication = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, appId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!Types.ObjectId.isValid(appId)) {
      res.status(404).json({ message: "Aplicacao nao encontrada" });
      return;
    }
    const deleted = await AestheticApplication.findOneAndDelete({
      _id: appId,
      establishment: establishmentId,
      client: clientId,
    });
    if (!deleted) {
      res.status(404).json({ message: "Aplicacao nao encontrada" });
      return;
    }
    res.json({ message: "Aplicacao removida", _id: appId });
  } catch (err) {
    console.error("deleteApplication(estetica):", err);
    res.status(500).json({ message: "Erro ao remover aplicacao" });
  }
};
