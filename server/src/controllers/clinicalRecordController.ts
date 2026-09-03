import { Response } from "express";
import { ClinicalRecord } from "../models/ClinicalRecord";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import { generateClinicalRecordPdf } from "../utils/clinicalRecordPdf";

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

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

const sanitizeSessions = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((x) => {
          const it = (x || {}) as Record<string, unknown>;
          return {
            date: cleanText(it.date),
            subjective: cleanText(it.subjective),
            objective: cleanText(it.objective),
            assessment: cleanText(it.assessment),
            plan: cleanText(it.plan),
            cid: cleanText(it.cid),
          };
        })
        .filter(
          (s) =>
            s.date || s.subjective || s.objective || s.assessment || s.plan
        )
    : [];

const buildPayload = (body: Record<string, unknown>) => ({
  patientName: cleanText(body.patientName),
  patientPhone: cleanText(body.patientPhone),
  complaint: cleanText(body.complaint),
  history: cleanText(body.history),
  sessions: sanitizeSessions(body.sessions),
  nextReturn: cleanText(body.nextReturn),
  notes: cleanText(body.notes),
});

export const listRecords = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await ClinicalRecord.find({
      establishment: establishmentId,
    }).sort({ updatedAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listRecords:", err);
    res.status(500).json({ message: "Erro ao listar fichas" });
  }
};

export const createRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const rec = await ClinicalRecord.create({
      establishment: establishmentId,
      author: req.userId,
      ...buildPayload(req.body),
    });
    res.status(201).json(rec);
  } catch (err) {
    console.error("createRecord:", err);
    res.status(500).json({ message: "Erro ao criar ficha" });
  }
};

export const updateRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const rec = await ClinicalRecord.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!rec) {
      res.status(404).json({ message: "Ficha nao encontrada" });
      return;
    }
    Object.assign(rec, buildPayload(req.body));
    await rec.save();
    res.json(rec);
  } catch (err) {
    console.error("updateRecord:", err);
    res.status(500).json({ message: "Erro ao atualizar ficha" });
  }
};

// GET /api/clinical-records/:establishmentId/:id/pdf
export const recordPdf = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const [rec, est] = await Promise.all([
      ClinicalRecord.findOne({ _id: id, establishment: establishmentId }),
      Establishment.findById(establishmentId).select("name phone"),
    ]);
    if (!rec) {
      res.status(404).json({ message: "Ficha nao encontrada" });
      return;
    }
    const pdf = await generateClinicalRecordPdf({
      establishmentName: est?.name || "",
      phone: est?.phone,
      patientName: rec.patientName,
      patientPhone: rec.patientPhone,
      complaint: rec.complaint,
      history: rec.history,
      nextReturn: rec.nextReturn,
      notes: rec.notes,
      sessions: rec.sessions.map((s) => ({
        date: s.date,
        subjective: s.subjective,
        objective: s.objective,
        assessment: s.assessment,
        plan: s.plan,
        cid: s.cid,
      })),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="ficha-clinica.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("recordPdf:", err);
    res.status(500).json({ message: "Erro ao gerar o PDF" });
  }
};

export const deleteRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const del = await ClinicalRecord.findOneAndDelete({
      _id: id,
      establishment: establishmentId,
    });
    if (!del) {
      res.status(404).json({ message: "Ficha nao encontrada" });
      return;
    }
    res.json({ message: "Ficha removida", _id: id });
  } catch (err) {
    console.error("deleteRecord:", err);
    res.status(500).json({ message: "Erro ao remover ficha" });
  }
};
