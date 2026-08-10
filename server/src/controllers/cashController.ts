import { Response } from "express";
import { CashSession } from "../models/CashSession";
import { CashMovement } from "../models/CashMovement";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import { Types } from "mongoose";
import { postPendingBookingsForDate } from "../utils/cashPosting";
import { Product } from "../models/Product";
import { StockMovement } from "../models/StockMovement";

// so o dono do estabelecimento opera o caixa
// dono OU membro-profissional ativo opera o caixa
const canOperate = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [
      { owner: userId },
      { members: { $elemMatch: { professional: userId, active: true } } },
    ],
  }).select("_id");
  return !!est;
};

// calcula os totais de uma sessao a partir dos movimentos.
const computeTotals = async (session: {
  _id: Types.ObjectId;
  openingAmount: number;
}) => {
  const movements = await CashMovement.find({ session: session._id });

  let cash = session.openingAmount;
  const byType = { entrada: 0, saida: 0, sangria: 0, suprimento: 0 };
  const byMethod = { dinheiro: 0, cartao: 0, pix: 0, outro: 0 };

  for (const m of movements) {
    byType[m.type] += m.amount;
    byMethod[m.method] += m.amount;

    if (m.method === "dinheiro") {
      if (m.type === "entrada" || m.type === "suprimento") cash += m.amount;
      else cash -= m.amount;
    }
  }

  return {
    expectedCash: cash,
    byType,
    byMethod,
    movementCount: movements.length,
  };
};

// mapa id->nome dos profissionais do estabelecimento
const professionalNameMap = async (
  establishmentId: Types.ObjectId | string
): Promise<Map<string, string>> => {
  const est = await Establishment.findById(establishmentId).select(
    "professionals"
  );
  const map = new Map<string, string>();
  est?.professionals.forEach((p) => map.set(p._id.toString(), p.name));
  return map;
};

// anexa professionalName aos movimentos
const attachProfessionalNames = async (
  establishmentId: Types.ObjectId | string,
  movements: unknown[]
): Promise<unknown[]> => {
  const nameById = await professionalNameMap(establishmentId);

  return movements.map((mRaw) => {
    const m = (mRaw as { toObject?: () => Record<string, unknown> }).toObject
      ? (mRaw as { toObject: () => Record<string, unknown> }).toObject()
      : (mRaw as Record<string, unknown>);
    const profId = m.professional ? String(m.professional) : null;
    return {
      ...m,
      professionalName: profId ? nameById.get(profId) ?? null : null,
    };
  });
};

// GET /api/cash/:establishmentId/current  (protegido, dono)
export const getCurrentSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    const session = await CashSession.findOne({
      establishment: establishmentId,
      status: "aberto",
    }).populate("openedBy", "name");

    if (!session) {
      res.json({ session: null });
      return;
    }

    const totals = await computeTotals(session);
    const rawMovements = await CashMovement.find({ session: session._id })
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    const movements = await attachProfessionalNames(
      establishmentId,
      rawMovements
    );

    res.json({ session, totals, movements });
  } catch (err) {
    console.error("getCurrentSession:", err);
    res.status(500).json({ message: "Erro ao buscar caixa" });
  }
};

// POST /api/cash/:establishmentId/open  (protegido, dono)
export const openSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { openingAmount = 0 } = req.body;

    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    if (typeof openingAmount !== "number" || openingAmount < 0) {
      res.status(400).json({ message: "Valor de abertura invalido" });
      return;
    }

    const existing = await CashSession.findOne({
      establishment: establishmentId,
      status: "aberto",
    });
    if (existing) {
      res.status(409).json({ message: "Ja existe um caixa aberto" });
      return;
    }

    const session = await CashSession.create({
      establishment: establishmentId,
      openedBy: req.userId,
      openingAmount,
      status: "aberto",
    });

    // lanca TODAS as conclusoes pendentes (qualquer data)
    let postedCount = 0;
    try {
      postedCount = await postPendingBookingsForDate(
        establishmentId,
        session._id,
        session.openedAt,
        req.userId!
      );
    } catch (e) {
      console.error("postPendingBookings:", e);
    }

    res.status(201).json({ session, postedCount });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      res.status(409).json({ message: "Ja existe um caixa aberto" });
      return;
    }
    console.error("openSession:", err);
    res.status(500).json({ message: "Erro ao abrir caixa" });
  }
};

// POST /api/cash/:establishmentId/movement  (protegido, dono)
export const addMovement = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { type, method = "dinheiro", amount, description } = req.body;

    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    const validTypes = ["entrada", "saida", "sangria", "suprimento"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: "Tipo de movimento invalido" });
      return;
    }
    const validMethods = ["dinheiro", "cartao", "pix", "outro"];
    if (!validMethods.includes(method)) {
      res.status(400).json({ message: "Forma de pagamento invalida" });
      return;
    }
    if (typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ message: "Valor invalido" });
      return;
    }

    if ((type === "sangria" || type === "suprimento") && method !== "dinheiro") {
      res
        .status(400)
        .json({ message: "Sangria e suprimento sao sempre em dinheiro" });
      return;
    }

    const session = await CashSession.findOne({
      establishment: establishmentId,
      status: "aberto",
    });
    if (!session) {
      res.status(409).json({ message: "Nao ha caixa aberto" });
      return;
    }

    const movement = await CashMovement.create({
      session: session._id,
      establishment: establishmentId,
      createdBy: req.userId,
      type,
      method,
      amount,
      description: description || "",
      booking: null,
      professional: null,
    });

    const totals = await computeTotals(session);
    res.status(201).json({ movement, totals });
  } catch (err) {
    console.error("addMovement:", err);
    res.status(500).json({ message: "Erro ao lancar movimento" });
  }
};

// POST /api/cash/:establishmentId/close  (protegido, dono)
// body: { countedAmount, closingNotes? }
// Grava um SNAPSHOT completo (report) com todos os movimentos e totais.
export const closeSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { countedAmount, closingNotes } = req.body;

    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    if (typeof countedAmount !== "number" || countedAmount < 0) {
      res.status(400).json({ message: "Valor contado invalido" });
      return;
    }

    const session = await CashSession.findOne({
      establishment: establishmentId,
      status: "aberto",
    });
    if (!session) {
      res.status(409).json({ message: "Nao ha caixa aberto" });
      return;
    }

    const totals = await computeTotals(session);

    // monta as linhas do relatorio (movimentos congelados)
    const nameById = await professionalNameMap(establishmentId);
    const movements = await CashMovement.find({ session: session._id }).sort({
      createdAt: 1,
    });

    const lines = movements.map((m) => ({
      type: m.type,
      method: m.method,
      amount: m.amount,
      description: m.description || "",
      professionalName: m.professional
        ? nameById.get(m.professional.toString()) ?? null
        : null,
      createdAt: m.createdAt,
    }));

    const difference = countedAmount - totals.expectedCash;

    session.status = "fechado";
    session.closedBy = new Types.ObjectId(req.userId);
    session.closedAt = new Date();
    session.expectedAmount = totals.expectedCash;
    session.countedAmount = countedAmount;
    session.difference = difference;
    session.closingNotes = closingNotes || "";
    session.report = {
      openingAmount: session.openingAmount,
      byMethod: totals.byMethod,
      byType: totals.byType,
      expectedCash: totals.expectedCash,
      countedAmount,
      difference,
      totalRevenue: totals.byType.entrada,
      movementCount: totals.movementCount,
      lines,
      generatedAt: new Date(),
    };

    await session.save();

    res.json({ session, totals });
  } catch (err) {
    console.error("closeSession:", err);
    res.status(500).json({ message: "Erro ao fechar caixa" });
  }
};

// GET /api/cash/:establishmentId/history  (protegido, dono)
// devolve as sessoes fechadas COM o report (snapshot) para o relatorio
export const listSessions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = 10;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      CashSession.find({ establishment: establishmentId, status: "fechado" })
        .populate("openedBy", "name")
        .populate("closedBy", "name")
        .sort({ closedAt: -1 })
        .skip(skip)
        .limit(limit),
      CashSession.countDocuments({
        establishment: establishmentId,
        status: "fechado",
      }),
    ]);

    res.json({
      sessions,
      page,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + sessions.length < total,
    });
  } catch (err) {
    console.error("listSessions:", err);
    res.status(500).json({ message: "Erro ao listar sessoes" });
  }
};

// POST /api/cash/:establishmentId/sell  (protegido, dono)
// body: { productId, quantity, method, discount? }
//
// Vende um produto: lanca ENTRADA no caixa e da BAIXA no estoque,
// numa operacao so. Bloqueia se nao houver estoque suficiente.
export const sellProduct = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { productId, quantity, method = "dinheiro", discount } = req.body;

    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    const validMethods = ["dinheiro", "cartao", "pix", "outro"];
    if (!validMethods.includes(method)) {
      res.status(400).json({ message: "Forma de pagamento invalida" });
      return;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      res.status(400).json({ message: "Quantidade invalida" });
      return;
    }

    // precisa de caixa aberto para registrar a entrada
    const session = await CashSession.findOne({
      establishment: establishmentId,
      status: "aberto",
    });
    if (!session) {
      res
        .status(409)
        .json({ message: "Abra o caixa antes de registrar uma venda" });
      return;
    }

    const product = await Product.findOne({
      _id: productId,
      establishment: establishmentId,
      active: true,
    });
    if (!product) {
      res.status(404).json({ message: "Produto nao encontrado" });
      return;
    }

    // venda bloqueia estoque insuficiente
    if (product.stock < qty) {
      res.status(409).json({
        message: `Estoque insuficiente (disponivel: ${product.stock})`,
      });
      return;
    }

    // valor da venda (desconto opcional, nunca negativo)
    const gross = product.price * qty;
    const desconto =
      typeof discount === "number" && discount > 0 ? discount : 0;
    const amount = Math.max(0, gross - desconto);

    if (amount <= 0) {
      res.status(400).json({ message: "Valor da venda invalido" });
      return;
    }

    // 1. baixa no estoque (registrada como movimentacao)
    const stockBefore = product.stock;
    const stockAfter = stockBefore - qty;

    await StockMovement.create({
      establishment: establishmentId,
      product: product._id,
      type: "saida",
      quantity: qty,
      stockBefore,
      stockAfter,
      reason: "Venda no caixa",
      unitCost: 0,
      createdBy: req.userId,
      booking: null,
    });

    product.stock = stockAfter;
    await product.save();

    // 2. entrada no caixa
    const description =
      qty > 1 ? `${qty}x ${product.name}` : product.name;

    const movement = await CashMovement.create({
      session: session._id,
      establishment: establishmentId,
      createdBy: req.userId,
      type: "entrada",
      method,
      amount,
      description,
      booking: null,
      professional: null,
    });

    const totals = await computeTotals(session);

    // avisa se o estoque chegou ao minimo
    const warnings: string[] = [];
    if (product.minStock > 0 && stockAfter <= product.minStock) {
      warnings.push(
        `Estoque de "${product.name}" atingiu o nivel minimo (${stockAfter}).`
      );
    }

    res.status(201).json({ movement, product, totals, warnings });
  } catch (err) {
    console.error("sellProduct:", err);
    res.status(500).json({ message: "Erro ao registrar a venda" });
  }
};