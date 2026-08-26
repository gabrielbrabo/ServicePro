import { Response } from "express";
import { Odontogram } from "../models/Odontogram";
import { OdontogramSettings } from "../models/OdontogramSettings";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";
import {
  DEFAULT_TOOTH_STATUSES,
  NEUTRAL_STATUS,
  sanitizeStatuses,
  ToothStatusDef,
} from "../config/odontogramStatuses";

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

// dentes validos (FDI, permanentes)
const FDI = new Set<number>([
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33,
  34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
]);

// faces validas: V vestibular, O oclusal/incisal, M mesial, D distal, L lingual/palatina
const FACES = new Set<string>(["V", "O", "M", "D", "L"]);

// lista efetiva de status do estabelecimento: a personalizada (se houver) ou
// o padrao. Sempre inclui o neutro "higido".
const effectiveStatuses = async (
  establishmentId: string
): Promise<ToothStatusDef[]> => {
  const cfg = await OdontogramSettings.findOne({
    establishment: establishmentId,
  }).select("statuses");
  if (cfg && Array.isArray(cfg.statuses) && cfg.statuses.length > 0) {
    return sanitizeStatuses(cfg.statuses);
  }
  return DEFAULT_TOOTH_STATUSES;
};

// GET /api/odontogram/:establishmentId/:clientId
export const getOdontogram = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const odo = await Odontogram.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!odo) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        teeth: [],
        _isNew: true,
      });
      return;
    }
    res.json(odo);
  } catch (err) {
    console.error("getOdontogram:", err);
    res.status(500).json({ message: "Erro ao buscar odontograma" });
  }
};

// PUT /api/odontogram/:establishmentId/:clientId/tooth
// body: { number, status, note? }
export const setTooth = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este paciente nao tem agendamentos no estabelecimento" });
      return;
    }

    const number = Number(req.body.number);
    const status = String(req.body.status || "");
    const hasNote = typeof req.body.note === "string";
    const note = hasNote ? String(req.body.note).trim() : undefined;
    // face opcional: se vier, o status vale so pra aquela face
    const face =
      typeof req.body.face === "string"
        ? req.body.face.trim().toUpperCase()
        : undefined;

    if (!FDI.has(number)) {
      res.status(400).json({ message: "Dente invalido" });
      return;
    }
    if (face !== undefined && !FACES.has(face)) {
      res.status(400).json({ message: "Face invalida" });
      return;
    }
    const allowed = await effectiveStatuses(establishmentId);
    if (!allowed.some((s) => s.key === status)) {
      res.status(400).json({ message: "Status invalido" });
      return;
    }

    let odo = await Odontogram.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!odo) {
      odo = await Odontogram.create({
        establishment: establishmentId,
        client: clientId,
        teeth: [],
      });
    }

    // trabalha com objetos simples e reatribui no fim (evita quirks de subdoc)
    type PlainMark = {
      number: number;
      status?: string;
      note?: string;
      faces: { face: string; status: string }[];
    };
    const teeth: PlainMark[] = odo.teeth.map((t) => ({
      number: t.number,
      status: t.status || undefined,
      note: t.note || undefined,
      faces: (t.faces || []).map((f) => ({ face: f.face, status: f.status })),
    }));

    let mark = teeth.find((t) => t.number === number);
    if (!mark) {
      mark = { number, faces: [] };
      teeth.push(mark);
    }

    if (face) {
      // marca por face
      if (status === NEUTRAL_STATUS) {
        mark.faces = mark.faces.filter((f) => f.face !== face);
      } else {
        const f = mark.faces.find((x) => x.face === face);
        if (f) f.status = status;
        else mark.faces.push({ face, status });
      }
    } else {
      // condicao do dente inteiro
      mark.status = status === NEUTRAL_STATUS ? undefined : status;
    }

    if (hasNote) mark.note = note || undefined;

    // remove marcas vazias (sem status de dente, sem faces e sem nota)
    const pruned = teeth.filter(
      (t) => t.status || (t.faces && t.faces.length > 0) || t.note
    );
    // normaliza: faces vazio vira ausente (nao guarda array vazio)
    const finalTeeth = pruned.map((t) => ({
      number: t.number,
      ...(t.status ? { status: t.status } : {}),
      ...(t.note ? { note: t.note } : {}),
      ...(t.faces && t.faces.length > 0 ? { faces: t.faces } : {}),
    }));

    odo.teeth = finalTeeth as never;
    odo.updatedBy = req.userId as never;
    await odo.save();

    res.json(odo);
  } catch (err) {
    console.error("setTooth:", err);
    res.status(500).json({ message: "Erro ao salvar o dente" });
  }
};

// GET /api/odontogram/:establishmentId/statuses
// devolve a lista de status da clinica (ou o padrao) + se e o padrao.
export const getStatuses = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const cfg = await OdontogramSettings.findOne({
      establishment: establishmentId,
    }).select("statuses");

    const custom =
      cfg && Array.isArray(cfg.statuses) && cfg.statuses.length > 0;

    res.json({
      statuses: custom ? sanitizeStatuses(cfg!.statuses) : DEFAULT_TOOTH_STATUSES,
      isDefault: !custom,
    });
  } catch (err) {
    console.error("getStatuses:", err);
    res.status(500).json({ message: "Erro ao buscar status" });
  }
};

// PUT /api/odontogram/:establishmentId/statuses
// body: { statuses: [{ key, label, color }] }  (ou statuses: null p/ voltar ao padrao)
export const setStatuses = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    // reset: volta ao padrao (remove a config personalizada)
    if (req.body.statuses === null) {
      await OdontogramSettings.findOneAndDelete({
        establishment: establishmentId,
      });
      res.json({ statuses: DEFAULT_TOOTH_STATUSES, isDefault: true });
      return;
    }

    const statuses = sanitizeStatuses(req.body.statuses);
    if (statuses.length < 2) {
      res
        .status(400)
        .json({ message: "Inclua ao menos um status alem do Hígido" });
      return;
    }

    const cfg = await OdontogramSettings.findOneAndUpdate(
      { establishment: establishmentId },
      { statuses, updatedBy: req.userId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select("statuses");

    res.json({ statuses: sanitizeStatuses(cfg!.statuses), isDefault: false });
  } catch (err) {
    console.error("setStatuses:", err);
    res.status(500).json({ message: "Erro ao salvar os status" });
  }
};