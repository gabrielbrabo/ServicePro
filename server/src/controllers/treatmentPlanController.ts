import { Response } from "express";
import { Types } from "mongoose";
import { TreatmentPlan } from "../models/TreatmentPlan";
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

// so cria plano para quem tem historico no estabelecimento
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

// carrega o plano garantindo que pertence ao estabelecimento
async function loadPlan(establishmentId: string, planId: string) {
  if (!Types.ObjectId.isValid(planId)) return null;
  return TreatmentPlan.findOne({ _id: planId, establishment: establishmentId });
}

// GET /api/treatment-plans/:establishmentId/:clientId
export const listPlans = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const plans = await TreatmentPlan.find({
      establishment: establishmentId,
      client: clientId,
    }).sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    console.error("listPlans:", err);
    res.status(500).json({ message: "Erro ao listar planos" });
  }
};

// POST /api/treatment-plans/:establishmentId/:clientId
// body: { title?, items?: [{description, price}], discount?, installments? }
export const createPlan = async (
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

    const { title, items, discount, installments } = req.body;
    const cleanItems = Array.isArray(items)
      ? items
          .filter((i) => i && String(i.description || "").trim())
          .map((i) => ({
            description: String(i.description).trim(),
            price: Math.max(0, Number(i.price) || 0),
            done: false,
          }))
      : [];

    const plan = await TreatmentPlan.create({
      establishment: establishmentId,
      client: clientId,
      title:
        (typeof title === "string" && title.trim()) || "Plano de tratamento",
      items: cleanItems,
      discount: Math.max(0, Number(discount) || 0),
      installments: Math.max(1, Number(installments) || 1),
      createdBy: req.userId,
    });

    res.status(201).json(plan);
  } catch (err) {
    console.error("createPlan:", err);
    res.status(500).json({ message: "Erro ao criar plano" });
  }
};

// PUT /api/treatment-plans/:establishmentId/plans/:planId
// body: { title?, discount?, installments?, status? }
export const updatePlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, planId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const plan = await loadPlan(establishmentId, planId);
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }

    const { title, discount, installments, status } = req.body;
    if (typeof title === "string" && title.trim()) plan.title = title.trim();
    if (discount !== undefined) plan.discount = Math.max(0, Number(discount) || 0);
    if (installments !== undefined)
      plan.installments = Math.max(1, Number(installments) || 1);
    if (
      typeof status === "string" &&
      ["aberto", "concluido", "cancelado"].includes(status)
    ) {
      plan.status = status as ITreatmentPlanStatus;
    }

    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error("updatePlan:", err);
    res.status(500).json({ message: "Erro ao atualizar plano" });
  }
};

type ITreatmentPlanStatus = "aberto" | "concluido" | "cancelado";

// DELETE /api/treatment-plans/:establishmentId/plans/:planId
export const deletePlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, planId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const plan = await loadPlan(establishmentId, planId);
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    await plan.deleteOne();
    res.json({ message: "Plano removido", _id: planId });
  } catch (err) {
    console.error("deletePlan:", err);
    res.status(500).json({ message: "Erro ao remover plano" });
  }
};

// POST /api/treatment-plans/:establishmentId/plans/:planId/items
// body: { description, price }
export const addItem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, planId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const plan = await loadPlan(establishmentId, planId);
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    const { description, price } = req.body;
    if (!description || !String(description).trim()) {
      res.status(400).json({ message: "Descreva o procedimento" });
      return;
    }
    plan.items.push({
      description: String(description).trim(),
      price: Math.max(0, Number(price) || 0),
      done: false,
    } as never);
    await plan.save();
    res.status(201).json(plan);
  } catch (err) {
    console.error("addItem:", err);
    res.status(500).json({ message: "Erro ao adicionar procedimento" });
  }
};

// PATCH /api/treatment-plans/:establishmentId/plans/:planId/items/:itemId
// body: { description?, price?, done? }
export const updateItem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, planId, itemId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const plan = await loadPlan(establishmentId, planId);
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    const item = plan.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Procedimento nao encontrado" });
      return;
    }

    const { description, price, done } = req.body;
    if (typeof description === "string" && description.trim())
      item.description = description.trim();
    if (price !== undefined) item.price = Math.max(0, Number(price) || 0);
    if (done !== undefined) {
      item.done = !!done;
      item.doneAt = done ? new Date() : undefined;
    }

    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error("updateItem:", err);
    res.status(500).json({ message: "Erro ao atualizar procedimento" });
  }
};

// DELETE /api/treatment-plans/:establishmentId/plans/:planId/items/:itemId
export const deleteItem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, planId, itemId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const plan = await loadPlan(establishmentId, planId);
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    const item = plan.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Procedimento nao encontrado" });
      return;
    }
    item.deleteOne();
    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error("deleteItem:", err);
    res.status(500).json({ message: "Erro ao remover procedimento" });
  }
};