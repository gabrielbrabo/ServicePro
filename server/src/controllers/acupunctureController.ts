import { Response } from "express";
import { Types } from "mongoose";
import { AcupunctureProfile } from "../models/AcupunctureProfile";
import { AcupunctureSession } from "../models/AcupunctureSession";
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
const clampNum = (v: unknown, max = Infinity): number =>
  Math.min(max, Math.max(0, Number(v) || 0));

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

// ============ FICHA ============

export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const profile = await AcupunctureProfile.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!profile) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        mainComplaint: "",
        tcmPattern: "",
        tongue: "",
        pulse: "",
        contraindications: "",
        healthNotes: "",
        _isNew: true,
      });
      return;
    }
    res.json(profile);
  } catch (err) {
    console.error("getProfile:", err);
    res.status(500).json({ message: "Erro ao buscar a ficha do paciente" });
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este paciente nao tem atendimentos no estabelecimento",
      });
      return;
    }
    const update = {
      mainComplaint: cleanText(req.body.mainComplaint),
      tcmPattern: cleanText(req.body.tcmPattern),
      tongue: cleanText(req.body.tongue),
      pulse: cleanText(req.body.pulse),
      contraindications: cleanText(req.body.contraindications),
      healthNotes: cleanText(req.body.healthNotes),
    };
    const profile = await AcupunctureProfile.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      {
        $set: update,
        $setOnInsert: { establishment: establishmentId, client: clientId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
  } catch (err) {
    console.error("updateProfile:", err);
    res.status(500).json({ message: "Erro ao salvar a ficha do paciente" });
  }
};

// ============ SESSOES (pontos aplicados) ============

const sanitizePoints = (raw: unknown) =>
  Array.isArray(raw)
    ? (raw as unknown[])
        .map((p) => {
          const it = (p || {}) as Record<string, unknown>;
          return {
            point: cleanText(it.point),
            side: cleanText(it.side),
            method: cleanText(it.method),
            stimulation: cleanText(it.stimulation),
            note: cleanText(it.note),
          };
        })
        .filter((p) => p.point !== "")
    : [];

const buildSessionData = (body: Record<string, unknown>) => {
  const data: Record<string, unknown> = {
    eva: clampNum(body.eva, 10),
    retentionMin: clampNum(body.retentionMin),
    points: sanitizePoints(body.points),
    tcmNotes: cleanText(body.tcmNotes),
    recommendations: cleanText(body.recommendations),
    notes: cleanText(body.notes),
  };
  if (body.nextVisit) {
    const d = new Date(body.nextVisit as string);
    if (!isNaN(d.getTime())) data.nextVisit = d;
  } else if (body.nextVisit === null || body.nextVisit === "") {
    data.nextVisit = undefined;
  }
  return data;
};

async function loadSession(
  establishmentId: string,
  clientId: string,
  sessionId: string
) {
  if (!Types.ObjectId.isValid(sessionId)) return null;
  return AcupunctureSession.findOne({
    _id: sessionId,
    establishment: establishmentId,
    client: clientId,
  });
}

export const listSessions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await AcupunctureSession.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listSessions:", err);
    res.status(500).json({ message: "Erro ao listar sessoes" });
  }
};

export const createSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este paciente nao tem atendimentos no estabelecimento",
      });
      return;
    }
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    const item = await AcupunctureSession.create({
      establishment: establishmentId,
      client: clientId,
      author: req.userId,
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      ...buildSessionData(req.body),
    });
    const withAuthor = await item.populate("author", "name");
    res.status(201).json(withAuthor);
  } catch (err) {
    console.error("createSession:", err);
    res.status(500).json({ message: "Erro ao criar sessao" });
  }
};

export const updateSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, sessionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadSession(establishmentId, clientId, sessionId);
    if (!item) {
      res.status(404).json({ message: "Sessao nao encontrada" });
      return;
    }
    const data = buildSessionData(req.body);
    if ("nextVisit" in data && data.nextVisit === undefined) {
      item.set("nextVisit", undefined);
      delete (data as Record<string, unknown>).nextVisit;
    }
    Object.assign(item, data);
    if (req.body.date !== undefined) {
      const d = new Date(req.body.date);
      if (!isNaN(d.getTime())) item.date = d;
    }
    await item.save();
    const withAuthor = await item.populate("author", "name");
    res.json(withAuthor);
  } catch (err) {
    console.error("updateSession:", err);
    res.status(500).json({ message: "Erro ao atualizar sessao" });
  }
};

export const deleteSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, sessionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadSession(establishmentId, clientId, sessionId);
    if (!item) {
      res.status(404).json({ message: "Sessao nao encontrada" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Sessao removida", _id: sessionId });
  } catch (err) {
    console.error("deleteSession:", err);
    res.status(500).json({ message: "Erro ao remover sessao" });
  }
};
