import { Response } from "express";
import { LessonPlan } from "../models/LessonPlan";
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

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

// plano de aulas (topicos)
const sanitizeTopics = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((t) => {
          const it = (t || {}) as Record<string, unknown>;
          return {
            title: cleanText(it.title),
            done: !!it.done,
            date: cleanText(it.date),
          };
        })
        .filter((t) => t.title !== "" || t.date !== "")
    : [];

const buildPayload = (body: Record<string, unknown>) => ({
  studentName: cleanText(body.studentName),
  studentPhone: cleanText(body.studentPhone),
  subject: cleanText(body.subject),
  goal: cleanText(body.goal),
  topics: sanitizeTopics(body.topics),
  notes: cleanText(body.notes),
});

// GET /api/lesson-plans/:establishmentId
export const listPlans = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await LessonPlan.find({ establishment: establishmentId }).sort(
      { updatedAt: -1 }
    );
    res.json(items);
  } catch (err) {
    console.error("listPlans:", err);
    res.status(500).json({ message: "Erro ao listar planos de aula" });
  }
};

// POST /api/lesson-plans/:establishmentId
export const createPlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const plan = await LessonPlan.create({
      establishment: establishmentId,
      author: req.userId,
      ...buildPayload(req.body),
    });
    res.status(201).json(plan);
  } catch (err) {
    console.error("createPlan:", err);
    res.status(500).json({ message: "Erro ao criar plano de aula" });
  }
};

// PUT /api/lesson-plans/:establishmentId/:id
export const updatePlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const plan = await LessonPlan.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    Object.assign(plan, buildPayload(req.body));
    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error("updatePlan:", err);
    res.status(500).json({ message: "Erro ao atualizar plano de aula" });
  }
};

// DELETE /api/lesson-plans/:establishmentId/:id
export const deletePlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const deleted = await LessonPlan.findOneAndDelete({
      _id: id,
      establishment: establishmentId,
    });
    if (!deleted) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    res.json({ message: "Plano removido", _id: id });
  } catch (err) {
    console.error("deletePlan:", err);
    res.status(500).json({ message: "Erro ao remover plano de aula" });
  }
};
