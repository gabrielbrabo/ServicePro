import { Response } from "express";
import { Types } from "mongoose";
import { NursingProfile } from "../models/NursingProfile";
import { NursingRecord, NursingKind } from "../models/NursingRecord";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";

const KINDS: NursingKind[] = ["vital", "dressing", "medication"];

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
    const profile = await NursingProfile.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!profile) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        allergies: "",
        conditions: "",
        continuousMeds: "",
        bloodType: "",
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
      allergies: cleanText(req.body.allergies),
      conditions: cleanText(req.body.conditions),
      continuousMeds: cleanText(req.body.continuousMeds),
      bloodType: cleanText(req.body.bloodType),
      healthNotes: cleanText(req.body.healthNotes),
    };
    const profile = await NursingProfile.findOneAndUpdate(
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

// ============ REGISTROS (vitais / curativos / medicacao) ============

const buildRecordData = (body: Record<string, unknown>) => {
  const data: Record<string, unknown> = {
    notes: cleanText(body.notes),
    // vitais
    systolic: clampNum(body.systolic),
    diastolic: clampNum(body.diastolic),
    heartRate: clampNum(body.heartRate),
    respRate: clampNum(body.respRate),
    temperature: clampNum(body.temperature),
    spo2: clampNum(body.spo2),
    glucose: clampNum(body.glucose),
    pain: clampNum(body.pain),
    // curativo
    location: cleanText(body.location),
    aspect: cleanText(body.aspect),
    dressingType: cleanText(body.dressingType),
    materials: cleanText(body.materials),
    // medicacao / vacina
    medKind: cleanText(body.medKind),
    name: cleanText(body.name),
    dose: cleanText(body.dose),
    route: cleanText(body.route),
    site: cleanText(body.site),
    lot: cleanText(body.lot),
  };
  if (body.expiry) {
    const d = new Date(body.expiry as string);
    if (!isNaN(d.getTime())) data.expiry = d;
  }
  return data;
};

async function loadRecord(
  establishmentId: string,
  clientId: string,
  recordId: string
) {
  if (!Types.ObjectId.isValid(recordId)) return null;
  return NursingRecord.findOne({
    _id: recordId,
    establishment: establishmentId,
    client: clientId,
  });
}

// GET /api/nursing/:establishmentId/:clientId/records?kind=vital
export const listRecords = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const filter: Record<string, unknown> = {
      establishment: establishmentId,
      client: clientId,
    };
    const kind = String(req.query.kind || "");
    if (KINDS.includes(kind as NursingKind)) filter.kind = kind;
    const items = await NursingRecord.find(filter)
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listRecords:", err);
    res.status(500).json({ message: "Erro ao listar registros" });
  }
};

// POST /api/nursing/:establishmentId/:clientId/records
export const createRecord = async (
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
    const kind = String(req.body.kind || "");
    if (!KINDS.includes(kind as NursingKind)) {
      res.status(400).json({ message: "Tipo de registro invalido" });
      return;
    }
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    const item = await NursingRecord.create({
      establishment: establishmentId,
      client: clientId,
      author: req.userId,
      kind,
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      ...buildRecordData(req.body),
    });
    const withAuthor = await item.populate("author", "name");
    res.status(201).json(withAuthor);
  } catch (err) {
    console.error("createRecord:", err);
    res.status(500).json({ message: "Erro ao criar registro" });
  }
};

// PUT /api/nursing/:establishmentId/:clientId/records/:recordId
export const updateRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, recordId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadRecord(establishmentId, clientId, recordId);
    if (!item) {
      res.status(404).json({ message: "Registro nao encontrado" });
      return;
    }
    Object.assign(item, buildRecordData(req.body));
    if (req.body.date !== undefined) {
      const d = new Date(req.body.date);
      if (!isNaN(d.getTime())) item.date = d;
    }
    await item.save();
    const withAuthor = await item.populate("author", "name");
    res.json(withAuthor);
  } catch (err) {
    console.error("updateRecord:", err);
    res.status(500).json({ message: "Erro ao atualizar registro" });
  }
};

// DELETE /api/nursing/:establishmentId/:clientId/records/:recordId
export const deleteRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, recordId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadRecord(establishmentId, clientId, recordId);
    if (!item) {
      res.status(404).json({ message: "Registro nao encontrado" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Registro removido", _id: recordId });
  } catch (err) {
    console.error("deleteRecord:", err);
    res.status(500).json({ message: "Erro ao remover registro" });
  }
};
