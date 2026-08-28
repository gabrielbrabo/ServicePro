import { Response } from "express";
import { BeautyBeforeAfter } from "../models/BeautyBeforeAfter";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";

// dono OU membro do estabelecimento
const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  });
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

// GET /api/beauty-before-after/:establishmentId/:clientId  (dono/equipe)
export const listBeforeAfter = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const items = await BeautyBeforeAfter.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .populate("service", "title")
      .sort({ date: -1, createdAt: -1 });

    res.json(items);
  } catch (err) {
    console.error("listBeforeAfter:", err);
    res.status(500).json({ message: "Erro ao buscar registros" });
  }
};

// POST /api/beauty-before-after/:establishmentId/:clientId  (dono/equipe)
// body: { beforeUrl?, afterUrl?, note?, serviceId?, date? }
export const addBeforeAfter = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    const { beforeUrl, afterUrl, note, serviceId, date } = req.body;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este cliente nao tem agendamentos no estabelecimento",
      });
      return;
    }

    if (!beforeUrl && !afterUrl) {
      res.status(400).json({ message: "Envie ao menos uma foto" });
      return;
    }

    const created = await BeautyBeforeAfter.create({
      establishment: establishmentId,
      client: clientId,
      beforeUrl: beforeUrl || "",
      afterUrl: afterUrl || "",
      note: note ? String(note).trim() : "",
      service: serviceId || null,
      date: date ? new Date(date) : new Date(),
      author: req.userId,
    });

    const populated = await created.populate([
      { path: "author", select: "name" },
      { path: "service", select: "title" },
    ]);

    res.status(201).json(populated);
  } catch (err) {
    console.error("addBeforeAfter:", err);
    res.status(500).json({ message: "Erro ao salvar registro" });
  }
};

// DELETE /api/beauty-before-after/:establishmentId/:clientId/:itemId  (dono/equipe)
export const deleteBeforeAfter = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, itemId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const deleted = await BeautyBeforeAfter.findOneAndDelete({
      _id: itemId,
      establishment: establishmentId,
      client: clientId,
    });

    if (!deleted) {
      res.status(404).json({ message: "Registro nao encontrado" });
      return;
    }

    // devolve as URLs para o front limpar os objetos no S3
    res.json({
      message: "Registro removido",
      _id: itemId,
      beforeUrl: deleted.beforeUrl,
      afterUrl: deleted.afterUrl,
    });
  } catch (err) {
    console.error("deleteBeforeAfter:", err);
    res.status(500).json({ message: "Erro ao remover registro" });
  }
};
