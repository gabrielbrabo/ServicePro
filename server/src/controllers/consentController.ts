import { Response } from "express";
import { Types } from "mongoose";
import { ConsentTerm } from "../models/ConsentTerm";
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

const VALID_KINDS = ["procedimento", "imagem", "outro"];

// GET /api/consents/:establishmentId/:clientId
export const listTerms = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const items = await ConsentTerm.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listTerms:", err);
    res.status(500).json({ message: "Erro ao listar termos" });
  }
};

// POST /api/consents/:establishmentId/:clientId
// body: { kind?, title, content?, signedName?, signed?, attachmentUrl? }
export const createTerm = async (
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
      res.status(400).json({ message: "Informe o titulo do termo" });
      return;
    }
    const kind = VALID_KINDS.includes(req.body.kind)
      ? req.body.kind
      : "procedimento";
    const signed = req.body.signed === true;

    const term = await ConsentTerm.create({
      establishment: establishmentId,
      client: clientId,
      kind,
      title,
      content: cleanText(req.body.content),
      signedName: cleanText(req.body.signedName),
      signedAt: signed ? new Date() : null,
      attachmentUrl:
        typeof req.body.attachmentUrl === "string"
          ? req.body.attachmentUrl
          : "",
      author: req.userId,
    });

    const populated = await term.populate("author", "name");
    res.status(201).json(populated);
  } catch (err) {
    console.error("createTerm:", err);
    res.status(500).json({ message: "Erro ao criar termo" });
  }
};

// PATCH /api/consents/:establishmentId/:clientId/:termId
// marca como assinado/nao assinado. body: { signed, signedName? }
export const signTerm = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, termId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!Types.ObjectId.isValid(termId)) {
      res.status(404).json({ message: "Termo nao encontrado" });
      return;
    }
    const term = await ConsentTerm.findOne({
      _id: termId,
      establishment: establishmentId,
      client: clientId,
    });
    if (!term) {
      res.status(404).json({ message: "Termo nao encontrado" });
      return;
    }
    if (req.body.signed === true) {
      term.signedAt = new Date();
      if (typeof req.body.signedName === "string")
        term.signedName = req.body.signedName.trim();
    } else if (req.body.signed === false) {
      term.signedAt = null;
    }
    await term.save();
    const populated = await term.populate("author", "name");
    res.json(populated);
  } catch (err) {
    console.error("signTerm:", err);
    res.status(500).json({ message: "Erro ao atualizar termo" });
  }
};

// DELETE /api/consents/:establishmentId/:clientId/:termId
export const deleteTerm = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, termId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const deleted = await ConsentTerm.findOneAndDelete({
      _id: termId,
      establishment: establishmentId,
      client: clientId,
    });
    if (!deleted) {
      res.status(404).json({ message: "Termo nao encontrado" });
      return;
    }
    res.json({
      message: "Termo removido",
      _id: termId,
      attachmentUrl: deleted.attachmentUrl,
    });
  } catch (err) {
    console.error("deleteTerm:", err);
    res.status(500).json({ message: "Erro ao remover termo" });
  }
};
