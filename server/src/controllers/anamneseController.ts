import { Request, Response } from "express";
import { AnamneseSubmission } from "../models/AnamneseSubmission";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";

// perguntas fixas da anamnese (intake generico de saude)
export const ANAMNESE_QUESTIONS = [
  "Qual o motivo da consulta / queixa principal?",
  "Já possui algum diagnóstico ou faz tratamento em andamento?",
  "Faz uso de medicamentos? Quais?",
  "Possui alergias? Quais?",
  "Doenças pré-existentes (diabetes, hipertensão, cardíacas, etc.)?",
  "Já passou por cirurgias? Quais e quando?",
  "Histórico na família de doenças relevantes?",
  "Observações que gostaria de informar ao profissional?",
];

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

// GET publico /api/public/anamnese/:establishmentId -> nome + perguntas
export const getForm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const est = await Establishment.findById(establishmentId).select("name");
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    res.json({ establishmentName: est.name, questions: ANAMNESE_QUESTIONS });
  } catch (err) {
    console.error("getForm:", err);
    res.status(500).json({ message: "Erro ao carregar a anamnese" });
  }
};

// POST publico /api/public/anamnese/:establishmentId -> salva a submissao
export const submit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const est = await Establishment.findById(establishmentId).select("_id");
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    const patientName = cleanText(req.body.patientName);
    if (!patientName) {
      res.status(400).json({ message: "Informe seu nome" });
      return;
    }
    const raw = Array.isArray(req.body.answers) ? req.body.answers : [];
    const answers = raw
      .map((a: unknown) => {
        const it = (a || {}) as Record<string, unknown>;
        return { question: cleanText(it.question), answer: cleanText(it.answer) };
      })
      .filter((a: { question: string; answer: string }) => a.question !== "");
    await AnamneseSubmission.create({
      establishment: establishmentId,
      patientName,
      patientPhone: cleanText(req.body.patientPhone),
      answers,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("submit anamnese:", err);
    res.status(500).json({ message: "Erro ao enviar a anamnese" });
  }
};

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

// GET protegido /api/anamnese/:establishmentId -> lista as submissoes
export const listSubmissions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const items = await AnamneseSubmission.find({
      establishment: establishmentId,
    })
      .sort({ createdAt: -1 })
      .limit(300);
    res.json(items);
  } catch (err) {
    console.error("listSubmissions:", err);
    res.status(500).json({ message: "Erro ao listar anamneses" });
  }
};

// DELETE protegido /api/anamnese/:establishmentId/:id
export const deleteSubmission = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const del = await AnamneseSubmission.findOneAndDelete({
      _id: id,
      establishment: establishmentId,
    });
    if (!del) {
      res.status(404).json({ message: "Anamnese nao encontrada" });
      return;
    }
    res.json({ message: "Anamnese removida", _id: id });
  } catch (err) {
    console.error("deleteSubmission:", err);
    res.status(500).json({ message: "Erro ao remover anamnese" });
  }
};
