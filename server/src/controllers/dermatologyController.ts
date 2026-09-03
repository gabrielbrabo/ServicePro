import { Response } from "express";
import { Types } from "mongoose";
import { DermatologyProfile } from "../models/DermatologyProfile";
import { DermatologySession } from "../models/DermatologySession";
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
const clampNum = (v: unknown): number => Math.max(0, Number(v) || 0);

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
    const profile = await DermatologyProfile.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!profile) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        phototype: "",
        mainComplaint: "",
        skinCancerHistory: "",
        sunExposure: "",
        allergies: "",
        medications: "",
        healthNotes: "",
        photos: [],
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
    const photos = Array.isArray(req.body.photos)
      ? (req.body.photos as unknown[])
          .map((p) => {
            const it = (p || {}) as Record<string, unknown>;
            const url = cleanText(it.url);
            if (!url) return null;
            const d = it.date ? new Date(it.date as string) : new Date();
            return {
              url,
              date: isNaN(d.getTime()) ? new Date() : d,
              note: cleanText(it.note),
            };
          })
          .filter((p): p is { url: string; date: Date; note: string } => !!p)
      : [];
    const update = {
      phototype: cleanText(req.body.phototype),
      mainComplaint: cleanText(req.body.mainComplaint),
      skinCancerHistory: cleanText(req.body.skinCancerHistory),
      sunExposure: cleanText(req.body.sunExposure),
      allergies: cleanText(req.body.allergies),
      medications: cleanText(req.body.medications),
      healthNotes: cleanText(req.body.healthNotes),
      photos,
    };
    const profile = await DermatologyProfile.findOneAndUpdate(
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

// ============ ATENDIMENTOS (mapa de lesoes + antes/depois) ============

const VIEWS = ["front", "back"];
const ABCDE = ["A", "B", "C", "D", "E"];

const sanitizeFindings = (raw: unknown) =>
  Array.isArray(raw)
    ? (raw as unknown[])
        .map((f) => {
          const it = (f || {}) as Record<string, unknown>;
          const view = VIEWS.includes(String(it.view))
            ? (it.view as string)
            : "front";
          const abcde = Array.isArray(it.abcde)
            ? (it.abcde as unknown[])
                .map((x) => String(x).toUpperCase())
                .filter((x) => ABCDE.includes(x))
            : [];
          return {
            region: cleanText(it.region),
            view,
            type: cleanText(it.type),
            size: clampNum(it.size),
            color: cleanText(it.color),
            abcde: Array.from(new Set(abcde)),
            note: cleanText(it.note),
          };
        })
        .filter((f) => f.region !== "" && f.type !== "")
    : [];

const sanitizePhotos = (raw: unknown) =>
  Array.isArray(raw)
    ? (raw as unknown[])
        .map((p) => {
          const it = (p || {}) as Record<string, unknown>;
          return { url: cleanText(it.url), note: cleanText(it.note) };
        })
        .filter((p) => p.url !== "")
    : [];

const buildSessionData = (body: Record<string, unknown>) => {
  const data: Record<string, unknown> = {
    findings: sanitizeFindings(body.findings),
    beforePhotos: sanitizePhotos(body.beforePhotos),
    afterPhotos: sanitizePhotos(body.afterPhotos),
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
  return DermatologySession.findOne({
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
    const items = await DermatologySession.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listSessions:", err);
    res.status(500).json({ message: "Erro ao listar atendimentos" });
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
    const item = await DermatologySession.create({
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
    res.status(500).json({ message: "Erro ao criar atendimento" });
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
      res.status(404).json({ message: "Atendimento nao encontrado" });
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
    res.status(500).json({ message: "Erro ao atualizar atendimento" });
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
      res.status(404).json({ message: "Atendimento nao encontrado" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Atendimento removido", _id: sessionId });
  } catch (err) {
    console.error("deleteSession:", err);
    res.status(500).json({ message: "Erro ao remover atendimento" });
  }
};
