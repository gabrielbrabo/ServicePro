import { Response } from "express";
import { BeautyFormula } from "../models/BeautyFormula";
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

// GET /api/beauty-formulas/:establishmentId/:clientId  (dono/equipe)
// historico de formulas do cliente, mais recentes primeiro
export const listFormulas = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const formulas = await BeautyFormula.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .populate("service", "title")
      .sort({ date: -1, createdAt: -1 });

    res.json(formulas);
  } catch (err) {
    console.error("listFormulas:", err);
    res.status(500).json({ message: "Erro ao buscar formulas" });
  }
};

// POST /api/beauty-formulas/:establishmentId/:clientId  (dono/equipe)
export const addFormula = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    const {
      date,
      category,
      serviceId,
      brand,
      formula,
      oxidant,
      timeMinutes,
      result,
    } = req.body;

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

    if (!formula || !String(formula).trim()) {
      res.status(400).json({ message: "Informe a formula" });
      return;
    }

    const created = await BeautyFormula.create({
      establishment: establishmentId,
      client: clientId,
      date: date ? new Date(date) : new Date(),
      category: category ? String(category).trim() : "",
      service: serviceId || null,
      brand: brand ? String(brand).trim() : "",
      formula: String(formula).trim(),
      oxidant: oxidant ? String(oxidant).trim() : "",
      timeMinutes: Number(timeMinutes) || 0,
      result: result ? String(result).trim() : "",
      author: req.userId,
    });

    const populated = await created.populate([
      { path: "author", select: "name" },
      { path: "service", select: "title" },
    ]);

    res.status(201).json(populated);
  } catch (err) {
    console.error("addFormula:", err);
    res.status(500).json({ message: "Erro ao registrar formula" });
  }
};

// DELETE /api/beauty-formulas/:establishmentId/:clientId/:formulaId  (dono/equipe)
export const deleteFormula = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, formulaId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const deleted = await BeautyFormula.findOneAndDelete({
      _id: formulaId,
      establishment: establishmentId,
      client: clientId,
    });

    if (!deleted) {
      res.status(404).json({ message: "Formula nao encontrada" });
      return;
    }

    res.json({ message: "Formula removida", _id: formulaId });
  } catch (err) {
    console.error("deleteFormula:", err);
    res.status(500).json({ message: "Erro ao remover formula" });
  }
};
