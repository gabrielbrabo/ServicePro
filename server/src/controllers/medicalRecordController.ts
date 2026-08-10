import { Response } from "express";
import { MedicalRecord } from "../models/MedicalRecord";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";
import { Types } from "mongoose";

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

// confirma que o cliente realmente tem historico com o estabelecimento
// (evita criar prontuario para alguem que nunca agendou ali)
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

// GET /api/records/:establishmentId/:clientId  (protegido, dono/equipe)
// retorna o prontuario; cria um vazio (em memoria) se ainda nao existir
export const getRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    let record = await MedicalRecord.findOne({
      establishment: establishmentId,
      client: clientId,
    }).populate("notes.author", "name");

    if (!record) {
      // nao cria no banco ainda; devolve estrutura vazia
      res.json({
        establishment: establishmentId,
        client: clientId,
        allergies: "",
        medications: "",
        observations: "",
        notes: [],
        _isNew: true,
      });
      return;
    }

    res.json(record);
  } catch (err) {
    console.error("getRecord:", err);
    res.status(500).json({ message: "Erro ao buscar prontuario" });
  }
};

// PUT /api/records/:establishmentId/:clientId  (protegido, dono/equipe)
// body: { allergies?, medications?, observations? }
// cria o prontuario se nao existir (upsert)
export const updateRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    const { allergies, medications, observations } = req.body;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    // so cria prontuario para quem tem historico no estabelecimento
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este cliente nao tem agendamentos no estabelecimento" });
      return;
    }

    const update: Record<string, unknown> = {};
    if (typeof allergies === "string") update.allergies = allergies;
    if (typeof medications === "string") update.medications = medications;
    if (typeof observations === "string") update.observations = observations;

    const record = await MedicalRecord.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      { $set: update, $setOnInsert: { establishment: establishmentId, client: clientId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate("notes.author", "name");

    res.json(record);
  } catch (err) {
    console.error("updateRecord:", err);
    res.status(500).json({ message: "Erro ao salvar prontuario" });
  }
};

// POST /api/records/:establishmentId/:clientId/notes  (protegido, dono/equipe)
// body: { text }
export const addNote = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    const { text } = req.body;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    if (!text || !String(text).trim()) {
      res.status(400).json({ message: "A anotacao nao pode estar vazia" });
      return;
    }

    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este cliente nao tem agendamentos no estabelecimento" });
      return;
    }

    const record = await MedicalRecord.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      {
        $setOnInsert: { establishment: establishmentId, client: clientId },
        $push: {
          notes: {
            text: String(text).trim(),
            author: req.userId,
            createdAt: new Date(),
          },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate("notes.author", "name");

    res.status(201).json(record);
  } catch (err) {
    console.error("addNote:", err);
    res.status(500).json({ message: "Erro ao adicionar anotacao" });
  }
};

// DELETE /api/records/:establishmentId/:clientId/notes/:noteId  (dono/equipe)
export const deleteNote = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, noteId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const record = await MedicalRecord.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!record) {
      res.status(404).json({ message: "Prontuario nao encontrado" });
      return;
    }

    const note = record.notes.id(noteId);
    if (!note) {
      res.status(404).json({ message: "Anotacao nao encontrada" });
      return;
    }

    note.deleteOne();
    await record.save();
    await record.populate("notes.author", "name");

    res.json(record);
  } catch (err) {
    console.error("deleteNote:", err);
    res.status(500).json({ message: "Erro ao remover anotacao" });
  }
};