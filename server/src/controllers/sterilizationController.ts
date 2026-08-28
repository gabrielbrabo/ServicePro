import { Response } from "express";
import { SterilizationCycle } from "../models/SterilizationCycle";
import { Establishment } from "../models/Establishment";
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

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

const VALID_INDICATOR = ["aprovado", "reprovado", "na"];

// GET /api/sterilization/:establishmentId
export const listCycles = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await SterilizationCycle.find({
      establishment: establishmentId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listCycles:", err);
    res.status(500).json({ message: "Erro ao listar ciclos" });
  }
};

// POST /api/sterilization/:establishmentId
export const addCycle = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    const indicator = VALID_INDICATOR.includes(req.body.indicator)
      ? req.body.indicator
      : "na";

    const cycle = await SterilizationCycle.create({
      establishment: establishmentId,
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      equipment: cleanText(req.body.equipment),
      load: cleanText(req.body.load),
      cycle: cleanText(req.body.cycle),
      indicator,
      responsible: cleanText(req.body.responsible),
      notes: cleanText(req.body.notes),
      author: req.userId,
    });
    const populated = await cycle.populate("author", "name");
    res.status(201).json(populated);
  } catch (err) {
    console.error("addCycle:", err);
    res.status(500).json({ message: "Erro ao registrar ciclo" });
  }
};

// DELETE /api/sterilization/:establishmentId/:cycleId
export const deleteCycle = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, cycleId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const deleted = await SterilizationCycle.findOneAndDelete({
      _id: cycleId,
      establishment: establishmentId,
    });
    if (!deleted) {
      res.status(404).json({ message: "Ciclo nao encontrado" });
      return;
    }
    res.json({ message: "Ciclo removido", _id: cycleId });
  } catch (err) {
    console.error("deleteCycle:", err);
    res.status(500).json({ message: "Erro ao remover ciclo" });
  }
};
