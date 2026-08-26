import { Response } from "express";
import { Types } from "mongoose";
import { SessionPackage } from "../models/SessionPackage";
import { PhysioAssessment } from "../models/PhysioAssessment";
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
  }).select("_id");
  return !!est;
};

// so cria registro para quem tem historico no estabelecimento
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

// ============ PACOTES DE SESSOES ============

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

// GET /api/physio/:establishmentId/:clientId/packages
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
    console.error("listPackages:", err);
    res.status(500).json({ message: "Erro ao listar pacotes" });
  }
};

// POST /api/physio/:establishmentId/:clientId/packages
// body: { title?, totalSessions, price?, notes? }
export const createPackage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este paciente nao tem atendimentos no estabelecimento" });
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
    console.error("createPackage:", err);
    res.status(500).json({ message: "Erro ao criar pacote" });
  }
};

// PATCH /api/physio/:establishmentId/:clientId/packages/:packageId
// body: { title?, totalSessions?, price?, notes?, status? }
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
    console.error("updatePackage:", err);
    res.status(500).json({ message: "Erro ao atualizar pacote" });
  }
};

// POST /api/physio/:establishmentId/:clientId/packages/:packageId/uses
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
      res.status(400).json({ message: "Este pacote ja atingiu o total de sessoes" });
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
    console.error("addPackageUse:", err);
    res.status(500).json({ message: "Erro ao registrar sessao" });
  }
};

// DELETE /api/physio/:establishmentId/:clientId/packages/:packageId/uses/:useId
// estorna (remove) uma sessao usada
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
    console.error("removePackageUse:", err);
    res.status(500).json({ message: "Erro ao estornar sessao" });
  }
};

// DELETE /api/physio/:establishmentId/:clientId/packages/:packageId
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
    console.error("deletePackage:", err);
    res.status(500).json({ message: "Erro ao remover pacote" });
  }
};

// ============ AVALIACOES FISIOTERAPEUTICAS ============

async function loadAssessment(
  establishmentId: string,
  clientId: string,
  assessmentId: string
) {
  if (!Types.ObjectId.isValid(assessmentId)) return null;
  return PhysioAssessment.findOne({
    _id: assessmentId,
    establishment: establishmentId,
    client: clientId,
  });
}

// EVA: 0-10 inteiro, ou null quando nao avaliado / invalido
const parseEva = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  if (isNaN(n)) return null;
  return Math.min(10, Math.max(0, n));
};

const assessmentHasContent = (a: {
  mainComplaint: string;
  rangeOfMotion: string;
  muscleStrength: string;
  observations: string;
  goals: string;
  painEva: number | null;
}): boolean =>
  !!(
    a.mainComplaint ||
    a.rangeOfMotion ||
    a.muscleStrength ||
    a.observations ||
    a.goals ||
    a.painEva !== null
  );

// GET /api/physio/:establishmentId/:clientId/assessments
export const listAssessments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await PhysioAssessment.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listAssessments:", err);
    res.status(500).json({ message: "Erro ao listar avaliacoes" });
  }
};

// POST /api/physio/:establishmentId/:clientId/assessments
export const createAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este paciente nao tem atendimentos no estabelecimento" });
      return;
    }
    const data = {
      mainComplaint: cleanText(req.body.mainComplaint),
      painEva: parseEva(req.body.painEva),
      rangeOfMotion: cleanText(req.body.rangeOfMotion),
      muscleStrength: cleanText(req.body.muscleStrength),
      observations: cleanText(req.body.observations),
      goals: cleanText(req.body.goals),
    };
    if (!assessmentHasContent(data)) {
      res
        .status(400)
        .json({ message: "Preencha ao menos um campo da avaliacao" });
      return;
    }
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    const item = await PhysioAssessment.create({
      establishment: establishmentId,
      client: clientId,
      author: req.userId,
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      ...data,
    });
    const withAuthor = await item.populate("author", "name");
    res.status(201).json(withAuthor);
  } catch (err) {
    console.error("createAssessment:", err);
    res.status(500).json({ message: "Erro ao criar avaliacao" });
  }
};

// PUT /api/physio/:establishmentId/:clientId/assessments/:assessmentId
export const updateAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, assessmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadAssessment(establishmentId, clientId, assessmentId);
    if (!item) {
      res.status(404).json({ message: "Avaliacao nao encontrada" });
      return;
    }
    if (req.body.mainComplaint !== undefined)
      item.mainComplaint = cleanText(req.body.mainComplaint);
    if (req.body.rangeOfMotion !== undefined)
      item.rangeOfMotion = cleanText(req.body.rangeOfMotion);
    if (req.body.muscleStrength !== undefined)
      item.muscleStrength = cleanText(req.body.muscleStrength);
    if (req.body.observations !== undefined)
      item.observations = cleanText(req.body.observations);
    if (req.body.goals !== undefined) item.goals = cleanText(req.body.goals);
    if (req.body.painEva !== undefined) item.painEva = parseEva(req.body.painEva);
    if (req.body.date !== undefined) {
      const d = new Date(req.body.date);
      if (!isNaN(d.getTime())) item.date = d;
    }
    if (
      !assessmentHasContent({
        mainComplaint: item.mainComplaint,
        rangeOfMotion: item.rangeOfMotion,
        muscleStrength: item.muscleStrength,
        observations: item.observations,
        goals: item.goals,
        painEva: item.painEva,
      })
    ) {
      res
        .status(400)
        .json({ message: "Preencha ao menos um campo da avaliacao" });
      return;
    }
    await item.save();
    const withAuthor = await item.populate("author", "name");
    res.json(withAuthor);
  } catch (err) {
    console.error("updateAssessment:", err);
    res.status(500).json({ message: "Erro ao atualizar avaliacao" });
  }
};

// DELETE /api/physio/:establishmentId/:clientId/assessments/:assessmentId
export const deleteAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, assessmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadAssessment(establishmentId, clientId, assessmentId);
    if (!item) {
      res.status(404).json({ message: "Avaliacao nao encontrada" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Avaliacao removida", _id: assessmentId });
  } catch (err) {
    console.error("deleteAssessment:", err);
    res.status(500).json({ message: "Erro ao remover avaliacao" });
  }
};
