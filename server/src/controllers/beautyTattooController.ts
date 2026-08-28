import { Response } from "express";
import { Types } from "mongoose";
import { BeautyTattoo } from "../models/BeautyTattoo";
import { TattooHealth } from "../models/TattooHealth";
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

const VALID_STATUS = ["orcamento", "em_andamento", "concluido"];

async function loadPiece(
  establishmentId: string,
  clientId: string,
  pieceId: string
) {
  if (!Types.ObjectId.isValid(pieceId)) return null;
  return BeautyTattoo.findOne({
    _id: pieceId,
    establishment: establishmentId,
    client: clientId,
  });
}

// GET /api/beauty-tattoo/:establishmentId/:clientId
export const listPieces = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await BeautyTattoo.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listPieces:", err);
    res.status(500).json({ message: "Erro ao listar tatuagens" });
  }
};

// POST /api/beauty-tattoo/:establishmentId/:clientId
export const createPiece = async (
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
    const title = cleanText(req.body.title);
    if (!title) {
      res.status(400).json({ message: "Informe o nome da tatuagem" });
      return;
    }
    const status = VALID_STATUS.includes(req.body.status)
      ? req.body.status
      : "orcamento";
    const piece = await BeautyTattoo.create({
      establishment: establishmentId,
      client: clientId,
      title,
      bodyRegion: cleanText(req.body.bodyRegion),
      size: cleanText(req.body.size),
      style: cleanText(req.body.style),
      referenceUrl:
        typeof req.body.referenceUrl === "string" ? req.body.referenceUrl : "",
      sessionsPlanned: Math.max(1, Math.floor(Number(req.body.sessionsPlanned) || 1)),
      status,
      quotePrice: Math.max(0, Number(req.body.quotePrice) || 0),
      depositPaid: Math.max(0, Number(req.body.depositPaid) || 0),
      aftercare: cleanText(req.body.aftercare),
      notes: cleanText(req.body.notes),
      author: req.userId,
    });
    const populated = await piece.populate("author", "name");
    res.status(201).json(populated);
  } catch (err) {
    console.error("createPiece:", err);
    res.status(500).json({ message: "Erro ao criar tatuagem" });
  }
};

// PATCH /api/beauty-tattoo/:establishmentId/:clientId/:pieceId
export const updatePiece = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, pieceId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const piece = await loadPiece(establishmentId, clientId, pieceId);
    if (!piece) {
      res.status(404).json({ message: "Tatuagem nao encontrada" });
      return;
    }
    if (req.body.title !== undefined) piece.title = cleanText(req.body.title);
    if (req.body.bodyRegion !== undefined)
      piece.bodyRegion = cleanText(req.body.bodyRegion);
    if (req.body.size !== undefined) piece.size = cleanText(req.body.size);
    if (req.body.style !== undefined) piece.style = cleanText(req.body.style);
    if (typeof req.body.referenceUrl === "string")
      piece.referenceUrl = req.body.referenceUrl;
    if (req.body.sessionsPlanned !== undefined)
      piece.sessionsPlanned = Math.max(
        1,
        Math.floor(Number(req.body.sessionsPlanned) || piece.sessionsPlanned)
      );
    if (req.body.quotePrice !== undefined)
      piece.quotePrice = Math.max(0, Number(req.body.quotePrice) || 0);
    if (req.body.depositPaid !== undefined)
      piece.depositPaid = Math.max(0, Number(req.body.depositPaid) || 0);
    if (req.body.aftercare !== undefined)
      piece.aftercare = cleanText(req.body.aftercare);
    if (req.body.notes !== undefined) piece.notes = cleanText(req.body.notes);
    if (VALID_STATUS.includes(req.body.status))
      piece.status = req.body.status;
    await piece.save();
    const populated = await piece.populate("author", "name");
    res.json(populated);
  } catch (err) {
    console.error("updatePiece:", err);
    res.status(500).json({ message: "Erro ao atualizar tatuagem" });
  }
};

// POST /api/beauty-tattoo/:establishmentId/:clientId/:pieceId/sessions
export const addSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, pieceId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const piece = await loadPiece(establishmentId, clientId, pieceId);
    if (!piece) {
      res.status(404).json({ message: "Tatuagem nao encontrada" });
      return;
    }
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    piece.sessions.push({
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      note: cleanText(req.body.note),
      healing: cleanText(req.body.healing),
      by: req.userId,
    } as never);
    // se estava em orcamento, passa a em andamento ao registrar a 1a sessao
    if (piece.status === "orcamento") piece.status = "em_andamento";
    await piece.save();
    const populated = await piece.populate("author", "name");
    res.status(201).json(populated);
  } catch (err) {
    console.error("addSession(tattoo):", err);
    res.status(500).json({ message: "Erro ao registrar sessao" });
  }
};

// DELETE /api/beauty-tattoo/:establishmentId/:clientId/:pieceId/sessions/:sessionId
export const removeSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, pieceId, sessionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const piece = await loadPiece(establishmentId, clientId, pieceId);
    if (!piece) {
      res.status(404).json({ message: "Tatuagem nao encontrada" });
      return;
    }
    const s = piece.sessions.id(sessionId);
    if (!s) {
      res.status(404).json({ message: "Sessao nao encontrada" });
      return;
    }
    s.deleteOne();
    await piece.save();
    const populated = await piece.populate("author", "name");
    res.json(populated);
  } catch (err) {
    console.error("removeSession(tattoo):", err);
    res.status(500).json({ message: "Erro ao remover sessao" });
  }
};

// DELETE /api/beauty-tattoo/:establishmentId/:clientId/:pieceId
export const deletePiece = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, pieceId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const deleted = await BeautyTattoo.findOneAndDelete({
      _id: pieceId,
      establishment: establishmentId,
      client: clientId,
    });
    if (!deleted) {
      res.status(404).json({ message: "Tatuagem nao encontrada" });
      return;
    }
    res.json({
      message: "Tatuagem removida",
      _id: pieceId,
      referenceUrl: deleted.referenceUrl,
    });
  } catch (err) {
    console.error("deletePiece:", err);
    res.status(500).json({ message: "Erro ao remover tatuagem" });
  }
};

// ============ DECLARACAO DE SAUDE (por cliente) ============

// GET /api/beauty-tattoo/:establishmentId/:clientId/health
export const getHealth = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const h = await TattooHealth.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!h) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        conditions: [],
        allergies: "",
        medications: "",
        pregnant: false,
        other: "",
        signedName: "",
        signedAt: null,
        _isNew: true,
      });
      return;
    }
    res.json(h);
  } catch (err) {
    console.error("getHealth(tattoo):", err);
    res.status(500).json({ message: "Erro ao buscar declaracao" });
  }
};

// PUT /api/beauty-tattoo/:establishmentId/:clientId/health
export const updateHealth = async (
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
    const b = req.body;
    const update: Record<string, unknown> = { updatedBy: req.userId };
    if (Array.isArray(b.conditions))
      update.conditions = b.conditions
        .filter((c: unknown) => typeof c === "string")
        .map((c: string) => c.trim())
        .filter(Boolean);
    if (typeof b.allergies === "string") update.allergies = cleanText(b.allergies);
    if (typeof b.medications === "string")
      update.medications = cleanText(b.medications);
    if (typeof b.pregnant === "boolean") update.pregnant = b.pregnant;
    if (typeof b.other === "string") update.other = cleanText(b.other);
    if (typeof b.signedName === "string")
      update.signedName = cleanText(b.signedName);
    if (b.signed === true) update.signedAt = new Date();
    else if (b.signed === false) update.signedAt = null;

    const h = await TattooHealth.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      {
        $set: update,
        $setOnInsert: { establishment: establishmentId, client: clientId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(h);
  } catch (err) {
    console.error("updateHealth(tattoo):", err);
    res.status(500).json({ message: "Erro ao salvar declaracao" });
  }
};
