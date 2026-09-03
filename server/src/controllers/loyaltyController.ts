import { Response } from "express";
import { Types } from "mongoose";
import { LoyaltyProgram } from "../models/LoyaltyProgram";
import { LoyaltyCard, ILoyaltyCard } from "../models/LoyaltyCard";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { notifyManyAsync } from "../utils/notify";
import { sendEmail } from "../config/email";
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
        bonusStampOnReview: true,
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
    if (typeof req.body.bonusStampOnReview === "boolean")
      update.bonusStampOnReview = req.body.bonusStampOnReview;

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

// Aplica UM carimbo no cartao seguindo a regra do programa:
// - se o cartao ja estava com a meta batida (stamps >= goal), o proximo
//   atendimento ZERA e comeca de novo (marca 1);
// - senao incrementa;
// - se ao final o cartao atingiu a meta, registra a CONQUISTA
//   (rewardsPending++) e devolve earned=true para disparar aviso/e-mail.
// A recompensa pendente so e consumida quando o dono/funcionario marca a
// entrega (redeem) — por isso a marcacao "recompensa pendente" persiste.
function stampCard(
  card: ILoyaltyCard,
  goal: number,
  actorId: string
): { earned: boolean } {
  if (card.stamps >= goal) {
    card.stamps = 1; // reinicia o ciclo apos um cartao completo
  } else {
    card.stamps += 1;
  }
  let earned = false;
  if (card.stamps >= goal) {
    card.rewardsPending += 1;
    earned = true;
  }
  card.history.push({
    action: earned ? "conquista" : "carimbo",
    date: new Date(),
    by: actorId,
  } as never);
  return { earned };
}

// HTML simples do e-mail de conquista (dono + equipe)
const loyaltyRewardEmailHtml = (args: {
  clientName: string;
  goal: number;
  reward: string;
  establishmentName: string;
}): string => `
  <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #0f766e; margin-bottom: 8px;">Recompensa de fidelidade 🎉</h2>
    <p style="color: #334155; line-height: 1.6;">
      <strong>${args.clientName}</strong> completou
      <strong>${args.goal}</strong> ${
  args.goal === 1 ? "serviço" : "serviços"
} no programa de fidelidade de
      <strong>${args.establishmentName}</strong>.
    </p>
    <div style="background: #f0fdfa; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="color: #334155; line-height: 1.6; margin: 4px 0;">
        <strong>Recompensa a entregar:</strong> ${args.reward}
      </p>
    </div>
    <p style="color: #334155; line-height: 1.6;">
      Ao entregar a recompensa, marque no painel de fidelidade para remover a
      pendência do cliente.
    </p>
    <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
      Você recebeu este e-mail porque tem uma conta no ServiçoPro.
    </p>
  </div>`;

// Descobre dono + equipe COM LOGIN (in-app + e-mail). Retorna ids e e-mails.
async function loyaltyRecipients(
  establishmentId: Types.ObjectId | string
): Promise<{ ids: string[]; emails: string[]; establishmentName: string }> {
  const est = await Establishment.findById(establishmentId).select(
    "owner members name"
  );
  if (!est) return { ids: [], emails: [], establishmentName: "" };

  const idSet = new Set<string>([est.owner.toString()]);
  for (const m of est.members) {
    if (m.active) idSet.add(m.professional.toString());
  }
  const ids = Array.from(idSet);

  const users = await User.find({
    _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
  }).select("email");
  const emails = Array.from(
    new Set(users.map((u) => u.email).filter(Boolean) as string[])
  );

  return { ids, emails, establishmentName: est.name || "seu estabelecimento" };
}

// Avisa dono + equipe (in-app + e-mail; WhatsApp fica para o futuro) que um
// cliente completou a meta e tem uma recompensa a receber.
async function notifyLoyaltyReward(args: {
  establishmentId: Types.ObjectId | string;
  clientId: Types.ObjectId | string;
  goal: number;
  reward: string;
}): Promise<void> {
  try {
    const { ids, emails, establishmentName } = await loyaltyRecipients(
      args.establishmentId
    );
    if (ids.length === 0) return;

    const client = await User.findById(args.clientId).select("name");
    const clientName = client?.name || "Cliente";
    const reward = args.reward?.trim() || "recompensa do programa";

    const body = `${clientName} completou ${args.goal} ${
      args.goal === 1 ? "serviço" : "serviços"
    } no programa de fidelidade. Recompensa: ${reward}.`;

    notifyManyAsync(ids, {
      type: "loyalty_reward",
      title: "Recompensa de fidelidade!",
      body,
      establishment: args.establishmentId,
    });

    const html = loyaltyRewardEmailHtml({
      clientName,
      goal: args.goal,
      reward,
      establishmentName,
    });
    for (const to of emails) {
      void sendEmail({
        to,
        subject: `Recompensa de fidelidade — ${clientName}`,
        html,
      });
    }
  } catch (err) {
    console.error("notifyLoyaltyReward:", err);
  }
}

// Carimba o cartao do cliente e avisa se bateu a meta. Reutilizado tanto pela
// conclusao do atendimento quanto pelo bonus de avaliacao.
async function stampAndNotify(
  program: { goal: number; reward: string },
  establishmentId: Types.ObjectId | string,
  clientId: Types.ObjectId | string,
  actorId: Types.ObjectId | string
): Promise<void> {
  const goal = Math.max(1, program.goal || 1);
  const card = await loadOrInitCard(String(establishmentId), String(clientId));
  const { earned } = stampCard(card, goal, String(actorId));
  await card.save();
  if (earned) {
    await notifyLoyaltyReward({
      establishmentId,
      clientId,
      goal: program.goal,
      reward: program.reward,
    });
  }
}

// Efeito colateral do "concluir atendimento": carimba automaticamente o
// cartao do cliente. Fire-and-forget — nunca derruba a conclusao do booking.
// Ignora silenciosamente se o estabelecimento nao tem programa ativo.
export const applyLoyaltyOnCompletion = async (
  establishmentId: Types.ObjectId | string,
  clientId: Types.ObjectId | string,
  actorId: Types.ObjectId | string
): Promise<void> => {
  try {
    const program = await LoyaltyProgram.findOne({
      establishment: establishmentId,
    });
    if (!program || !program.active) return; // sem programa ativo -> nao carimba
    await stampAndNotify(program, establishmentId, clientId, actorId);
  } catch (err) {
    console.error("applyLoyaltyOnCompletion:", err);
  }
};

// Bonus de AVALIACAO: quando o cliente avalia o atendimento, ganha +1 carimbo
// (se o programa estiver ativo e o bonus habilitado). Fire-and-forget.
export const applyLoyaltyOnReview = async (
  establishmentId: Types.ObjectId | string,
  clientId: Types.ObjectId | string,
  actorId: Types.ObjectId | string
): Promise<void> => {
  try {
    const program = await LoyaltyProgram.findOne({
      establishment: establishmentId,
    });
    if (!program || !program.active) return;
    if (program.bonusStampOnReview === false) return; // bonus desligado
    await stampAndNotify(program, establishmentId, clientId, actorId);
  } catch (err) {
    console.error("applyLoyaltyOnReview:", err);
  }
};

// GET /api/loyalty/:establishmentId/cards  (lista todos os cartoes do estab.)
export const listCards = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const cards = await LoyaltyCard.find({ establishment: establishmentId })
      .populate("client", "name avatar")
      .sort({ rewardsPending: -1, updatedAt: -1 });
    res.json(cards);
  } catch (err) {
    console.error("listCards:", err);
    res.status(500).json({ message: "Erro ao listar cartoes" });
  }
};

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
        rewardsPending: 0,
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

// POST /api/loyalty/:establishmentId/:clientId/stamp  (carimbo manual)
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
    const program = await LoyaltyProgram.findOne({
      establishment: establishmentId,
    });
    const goal = Math.max(1, (program ? program.goal : 10) || 10);

    const card = await loadOrInitCard(establishmentId, clientId);
    const { earned } = stampCard(card, goal, req.userId!);
    await card.save();

    if (earned && program) {
      await notifyLoyaltyReward({
        establishmentId,
        clientId,
        goal: program.goal,
        reward: program.reward,
      });
    }
    res.status(201).json(card);
  } catch (err) {
    console.error("addStamp:", err);
    res.status(500).json({ message: "Erro ao adicionar carimbo" });
  }
};

// DELETE /api/loyalty/:establishmentId/:clientId/stamp  (estorna um carimbo)
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

// POST /api/loyalty/:establishmentId/:clientId/redeem
// Marca que a recompensa PENDENTE foi ENTREGUE ao cliente. Consome uma
// pendencia (nao os carimbos) e registra AUDITORIA de quem entregou.
export const redeem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const card = await loadOrInitCard(establishmentId, clientId);
    if (card.rewardsPending <= 0) {
      res
        .status(400)
        .json({ message: "Este cliente nao tem recompensa pendente" });
      return;
    }
    card.rewardsPending -= 1;
    card.rewardsGiven += 1;
    card.history.push({
      action: "resgate",
      date: new Date(),
      by: req.userId,
    } as never);
    await card.save();

    // auditoria (LGPD/controle): registra quem marcou a entrega da recompensa
    try {
      await AuditLog.create({
        establishment: establishmentId,
        client: clientId,
        actor: req.userId,
        action: "update",
        resource: "fidelidade_resgate",
        method: req.method,
        path: req.originalUrl,
        status: 200,
        ip: req.ip,
      });
    } catch (auditErr) {
      console.error("redeem audit:", auditErr);
    }

    res.json(card);
  } catch (err) {
    console.error("redeem:", err);
    res.status(500).json({ message: "Erro ao registrar entrega da recompensa" });
  }
};
