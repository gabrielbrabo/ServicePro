import { Response } from "express";
import { Types } from "mongoose";
import { SessionPackage } from "../models/SessionPackage";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";

// Pacotes de sessoes para a area BELEZA (ex.: 10 sessoes de depilacao,
// pacote de limpeza de pele). Reaproveita o model SessionPackage; e o gate
// e o modulo "pacotes" (a fisioterapia usa o mesmo model pelo gate proprio).

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

async function loadPackage(
  establishmentId: string,
  clientId: string,
  packageId: string
) {
  if (!Types.ObjectId.isValid(packageId)) return null;
  return SessionPackage.findOne({
    _id: packageId,
    establishment: establishmentId,
    client: clientId,
  });
}

// ajusta o status conforme o saldo (nao mexe em "cancelado")
function syncPackageStatus(pkg: {
  uses: { length: number };
  totalSessions: number;
  status: "ativo" | "concluido" | "cancelado";
}) {
  if (pkg.status === "cancelado") return;
  pkg.status = pkg.uses.length >= pkg.totalSessions ? "concluido" : "ativo";
}

// GET /api/beauty-packages/:establishmentId/:clientId
export const listPackages = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await SessionPackage.find({
      establishment: establishmentId,
      client: clientId,
    }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listPackages(beauty):", err);
    res.status(500).json({ message: "Erro ao listar pacotes" });
  }
};

// POST /api/beauty-packages/:establishmentId/:clientId
// body: { title?, totalSessions, price?, notes? }
export const createPackage = async (
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
    const total = Math.max(1, Math.floor(Number(req.body.totalSessions) || 0));
    if (!total) {
      res.status(400).json({ message: "Informe o total de sessoes" });
      return;
    }
    const pkg = await SessionPackage.create({
      establishment: establishmentId,
      client: clientId,
      title: cleanText(req.body.title) || "Pacote de sessoes",
      totalSessions: total,
      price: Math.max(0, Number(req.body.price) || 0),
      notes: cleanText(req.body.notes),
      status: "ativo",
      createdBy: req.userId,
    });
    res.status(201).json(pkg);
  } catch (err) {
    console.error("createPackage(beauty):", err);
    res.status(500).json({ message: "Erro ao criar pacote" });
  }
};

// PATCH /api/beauty-packages/:establishmentId/:clientId/:packageId
export const updatePackage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, packageId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const pkg = await loadPackage(establishmentId, clientId, packageId);
    if (!pkg) {
      res.status(404).json({ message: "Pacote nao encontrado" });
      return;
    }
    if (typeof req.body.title === "string" && req.body.title.trim())
      pkg.title = req.body.title.trim();
    if (req.body.totalSessions !== undefined)
      pkg.totalSessions = Math.max(
        1,
        Math.floor(Number(req.body.totalSessions) || pkg.totalSessions)
      );
    if (req.body.price !== undefined)
      pkg.price = Math.max(0, Number(req.body.price) || 0);
    if (req.body.notes !== undefined) pkg.notes = cleanText(req.body.notes);
    if (
      typeof req.body.status === "string" &&
      ["ativo", "concluido", "cancelado"].includes(req.body.status)
    ) {
      pkg.status = req.body.status as "ativo" | "concluido" | "cancelado";
    } else {
      syncPackageStatus(pkg);
    }
    await pkg.save();
    res.json(pkg);
  } catch (err) {
    console.error("updatePackage(beauty):", err);
    res.status(500).json({ message: "Erro ao atualizar pacote" });
  }
};

// POST /api/beauty-packages/:establishmentId/:clientId/:packageId/uses
// registra uma sessao usada. body: { date?, note? }
export const addPackageUse = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, packageId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const pkg = await loadPackage(establishmentId, clientId, packageId);
    if (!pkg) {
      res.status(404).json({ message: "Pacote nao encontrado" });
      return;
    }
    if (pkg.uses.length >= pkg.totalSessions) {
      res
        .status(400)
        .json({ message: "Este pacote ja atingiu o total de sessoes" });
      return;
    }
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    pkg.uses.push({
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      by: req.userId,
      note: cleanText(req.body.note) || undefined,
    } as never);
    syncPackageStatus(pkg);
    await pkg.save();
    res.status(201).json(pkg);
  } catch (err) {
    console.error("addPackageUse(beauty):", err);
    res.status(500).json({ message: "Erro ao registrar sessao" });
  }
};

// DELETE /api/beauty-packages/:establishmentId/:clientId/:packageId/uses/:useId
export const removePackageUse = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, packageId, useId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const pkg = await loadPackage(establishmentId, clientId, packageId);
    if (!pkg) {
      res.status(404).json({ message: "Pacote nao encontrado" });
      return;
    }
    const use = pkg.uses.id(useId);
    if (!use) {
      res.status(404).json({ message: "Sessao nao encontrada" });
      return;
    }
    use.deleteOne();
    syncPackageStatus(pkg);
    await pkg.save();
    res.json(pkg);
  } catch (err) {
    console.error("removePackageUse(beauty):", err);
    res.status(500).json({ message: "Erro ao estornar sessao" });
  }
};

// DELETE /api/beauty-packages/:establishmentId/:clientId/:packageId
export const deletePackage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, packageId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const pkg = await loadPackage(establishmentId, clientId, packageId);
    if (!pkg) {
      res.status(404).json({ message: "Pacote nao encontrado" });
      return;
    }
    await pkg.deleteOne();
    res.json({ message: "Pacote removido", _id: packageId });
  } catch (err) {
    console.error("deletePackage(beauty):", err);
    res.status(500).json({ message: "Erro ao remover pacote" });
  }
};
