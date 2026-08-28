import { Response } from "express";
import { LoyaltyProgram } from "../models/LoyaltyProgram";
import { LoyaltyCard } from "../models/LoyaltyCard";
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

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

// ============ PROGRAMA (config do estabelecimento) ============

// GET /api/loyalty/program/:establishmentId
export const getProgram = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const program = await LoyaltyProgram.findOne({
      establishment: establishmentId,
    });
    if (!program) {
      res.json({
        establishment: establishmentId,
        goal: 10,
        reward: "",
        active: false,
        _isNew: true,
      });
      return;
    }
    res.json(program);
  } catch (err) {
    console.error("getProgram:", err);
    res.status(500).json({ message: "Erro ao buscar programa" });
  }
};

// PUT /api/loyalty/program/:establishmentId  body: { goal?, reward?, active? }
export const setProgram = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const update: Record<string, unknown> = {};
    if (req.body.goal !== undefined)
      update.goal = Math.max(1, Math.floor(Number(req.body.goal) || 1));
    if (typeof req.body.reward === "string")
      update.reward = req.body.reward.trim();
    if (typeof req.body.active === "boolean") update.active = req.body.active;

    const program = await LoyaltyProgram.findOneAndUpdate(
      { establishment: establishmentId },
      { $set: update, $setOnInsert: { establishment: establishmentId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(program);
  } catch (err) {
    console.error("setProgram:", err);
    res.status(500).json({ message: "Erro ao salvar programa" });
  }
};

// ============ CARTAO (por cliente) ============

async function loadOrInitCard(establishmentId: string, clientId: string) {
  let card = await LoyaltyCard.findOne({
    establishment: establishmentId,
    client: clientId,
  });
  if (!card) {
    card = await LoyaltyCard.create({
      establishment: establishmentId,
      client: clientId,
    });
  }
  return card;
}

// GET /api/loyalty/:establishmentId/:clientId
export const getCard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const card = await LoyaltyCard.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!card) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        stamps: 0,
        rewardsGiven: 0,
        history: [],
        _isNew: true,
      });
      return;
    }
    res.json(card);
  } catch (err) {
    console.error("getCard:", err);
    res.status(500).json({ message: "Erro ao buscar cartao" });
  }
};

// POST /api/loyalty/:establishmentId/:clientId/stamp
export const addStamp = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este cliente nao tem atendimentos no estabelecimento",
      });
      return;
    }
    const card = await loadOrInitCard(establishmentId, clientId);
    card.stamps += 1;
    card.history.push({
      action: "carimbo",
      date: new Date(),
      by: req.userId,
    } as never);
    await card.save();
    res.status(201).json(card);
  } catch (err) {
    console.error("addStamp:", err);
    res.status(500).json({ message: "Erro ao adicionar carimbo" });
  }
};

// DELETE /api/loyalty/:establishmentId/:clientId/stamp  (remove um carimbo)
export const removeStamp = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const card = await loadOrInitCard(establishmentId, clientId);
    if (card.stamps <= 0) {
      res.status(400).json({ message: "Nao ha carimbos para estornar" });
      return;
    }
    card.stamps -= 1;
    card.history.push({
      action: "estorno",
      date: new Date(),
      by: req.userId,
    } as never);
    await card.save();
    res.json(card);
  } catch (err) {
    console.error("removeStamp:", err);
    res.status(500).json({ message: "Erro ao estornar carimbo" });
  }
};

// POST /api/loyalty/:establishmentId/:clientId/redeem  (resgata a recompensa)
export const redeem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const program = await LoyaltyProgram.findOne({
      establishment: establishmentId,
    });
    const goal = program ? program.goal : 10;

    const card = await loadOrInitCard(establishmentId, clientId);
    if (card.stamps < goal) {
      res
        .status(400)
        .json({ message: "Carimbos insuficientes para resgatar" });
      return;
    }
    card.stamps -= goal;
    card.rewardsGiven += 1;
    card.history.push({
      action: "resgate",
      date: new Date(),
      by: req.userId,
    } as never);
    await card.save();
    res.json(card);
  } catch (err) {
    console.error("redeem:", err);
    res.status(500).json({ message: "Erro ao resgatar recompensa" });
  }
};
