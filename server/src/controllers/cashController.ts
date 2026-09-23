import { Response } from "express";
import { CashSession } from "../models/CashSession";
import { CashMovement, ICashMovement } from "../models/CashMovement";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import { Types } from "mongoose";
import { postPendingBookingsForDate } from "../utils/cashPosting";
import { Product } from "../models/Product";
import { StockMovement } from "../models/StockMovement";
import { User } from "../models/User";
import { generateCashReceiptPdf } from "../utils/cashReceiptPdf";

type Method = "dinheiro" | "cartao" | "pix" | "outro";
const CASH_METHODS: Method[] = ["dinheiro", "cartao", "pix", "outro"];
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// so o dono OU membro-profissional ativo opera o caixa
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

// so o dono ve o painel financeiro consolidado
const isOwner = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    owner: userId,
  }).select("_id");
  return !!est;
};

// um movimento conta no caixa? (nao estornado e — se fiado — ja pago)
const counts = (m: {
  status?: string;
  receivable?: boolean;
  paid?: boolean;
}): boolean => {
  if (m.status === "estornado") return false;
  if (m.receivable && !m.paid) return false;
  return true;
};

// parcelas efetivas de um movimento (usa payments[] quando houver)
const paymentsOf = (m: {
  method: Method;
  amount: number;
  payments?: { method: Method; amount: number }[];
}): { method: Method; amount: number }[] => {
  if (m.payments && m.payments.length > 0) {
    return m.payments.map((p) => ({ method: p.method, amount: p.amount }));
  }
  return [{ method: m.method, amount: m.amount }];
};

// calcula os totais de uma sessao a partir dos movimentos ATIVOS.
const computeTotals = async (session: {
  _id: Types.ObjectId;
  openingAmount: number;
}) => {
  const movements = await CashMovement.find({ session: session._id });

  let cash = session.openingAmount;
  const byType = { entrada: 0, saida: 0, sangria: 0, suprimento: 0 };
  const byMethod = { dinheiro: 0, cartao: 0, pix: 0, outro: 0 };
  let fees = 0;
  let discounts = 0;
  let movementCount = 0;

  for (const m of movements) {
    if (!counts(m)) continue;
    movementCount += 1;
    byType[m.type] += m.amount;
    fees += m.fee || 0;
    discounts += m.discount || 0;

    for (const p of paymentsOf(m)) {
      byMethod[p.method] += p.amount;
      if (p.method === "dinheiro") {
        if (m.type === "entrada" || m.type === "suprimento") cash += p.amount;
        else cash -= p.amount;
      }
    }
  }

  return {
    expectedCash: round2(cash),
    byType,
    byMethod,
    fees: round2(fees),
    discounts: round2(discounts),
    movementCount,
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

// "YYYY-MM-DD" interpretado como dia LOCAL (mesmo padrao das comissoes)
const parseLocalDay = (s: string, endOfDay: boolean): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
};

const rangeFromQuery = (
  q: Record<string, unknown>
): { from: Date; to: Date } => {
  const toParsed = q.to ? parseLocalDay(String(q.to), true) : null;
  const to = toParsed || new Date();
  if (!toParsed) to.setHours(23, 59, 59, 999);
  const fromParsed = q.from ? parseLocalDay(String(q.from), false) : null;
  const from = fromParsed || new Date(to.getFullYear(), to.getMonth(), 1);
  if (!fromParsed) from.setHours(0, 0, 0, 0);
  return { from, to };
};

// GET /api/cash/:establishmentId/current
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

// POST /api/cash/:establishmentId/open
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

// POST /api/cash/:establishmentId/movement
// movimento simples (entrada/saida/sangria/suprimento). Aceita profissional
// (entradas) e exige motivo em sangria/saida para trilha de auditoria.
export const addMovement = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const {
      type,
      method = "dinheiro",
      amount,
      description,
      professionalId,
    } = req.body;

    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    const validTypes = ["entrada", "saida", "sangria", "suprimento"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: "Tipo de movimento invalido" });
      return;
    }
    if (!CASH_METHODS.includes(method)) {
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

    const reason = typeof description === "string" ? description.trim() : "";
    if ((type === "sangria" || type === "saida") && !reason) {
      res.status(400).json({ message: "Informe o motivo da saída/sangria" });
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

    const professional =
      type === "entrada" &&
      typeof professionalId === "string" &&
      Types.ObjectId.isValid(professionalId)
        ? new Types.ObjectId(professionalId)
        : null;

    const movement = await CashMovement.create({
      session: session._id,
      establishment: establishmentId,
      createdBy: req.userId,
      type,
      method,
      amount,
      description: reason,
      booking: null,
      professional,
    });

    const totals = await computeTotals(session);
    res.status(201).json({ movement, totals });
  } catch (err) {
    console.error("addMovement:", err);
    res.status(500).json({ message: "Erro ao lancar movimento" });
  }
};

// POST /api/cash/:establishmentId/sale  — VENDA / COMANDA
// body: {
//   items: [{ kind, refId?, name, qty, unitPrice }],
//   discount?, fee?,
//   payments?: [{ method, amount }],  (ignorado quando receivable)
//   receivable?, dueDate?,
//   clientId?, clientName?, professionalId?, note?
// }
export const registerSale = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    const body = req.body as {
      items?: unknown;
      discount?: unknown;
      fee?: unknown;
      payments?: unknown;
      receivable?: unknown;
      dueDate?: unknown;
      clientId?: unknown;
      clientName?: unknown;
      professionalId?: unknown;
      note?: unknown;
    };

    // ---- itens ----
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems
      .map((i) => {
        const it = (i || {}) as Record<string, unknown>;
        const kind =
          it.kind === "servico" || it.kind === "produto" ? it.kind : "avulso";
        const qty = Math.max(0, Number(it.qty) || 0);
        const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
        const refId =
          typeof it.refId === "string" && Types.ObjectId.isValid(it.refId)
            ? new Types.ObjectId(it.refId)
            : null;
        return {
          kind: kind as "servico" | "produto" | "avulso",
          refId,
          name: typeof it.name === "string" ? it.name.trim() : "",
          qty,
          unitPrice,
          total: round2(qty * unitPrice),
        };
      })
      .filter((it) => it.qty > 0 && (it.name !== "" || it.refId));

    if (items.length === 0) {
      res.status(400).json({ message: "Adicione ao menos um item à venda" });
      return;
    }

    const gross = round2(items.reduce((s, it) => s + it.total, 0));
    const discount = Math.min(gross, Math.max(0, Number(body.discount) || 0));
    const total = round2(gross - discount);
    const fee = Math.max(0, Number(body.fee) || 0);

    if (total <= 0) {
      res.status(400).json({ message: "Valor da venda inválido" });
      return;
    }

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

    const receivable = body.receivable === true;

    // ---- pagamentos (split) ----
    let payments: { method: Method; amount: number }[] = [];
    if (!receivable) {
      const rawPay = Array.isArray(body.payments) ? body.payments : [];
      payments = rawPay
        .map((p) => {
          const pp = (p || {}) as Record<string, unknown>;
          const method = CASH_METHODS.includes(pp.method as Method)
            ? (pp.method as Method)
            : "dinheiro";
          return { method, amount: round2(Math.max(0, Number(pp.amount) || 0)) };
        })
        .filter((p) => p.amount > 0);

      if (payments.length === 0) {
        // sem split: dinheiro por padrao
        payments = [{ method: "dinheiro", amount: total }];
      }

      const paidSum = round2(payments.reduce((s, p) => s + p.amount, 0));
      if (Math.abs(paidSum - total) > 0.01) {
        res.status(400).json({
          message: `A soma dos pagamentos (${paidSum.toFixed(
            2
          )}) não bate com o total (${total.toFixed(2)})`,
        });
        return;
      }
    }

    // ---- estoque (valida tudo antes de baixar) ----
    const productItems = items.filter((it) => it.kind === "produto" && it.refId);
    const productDocs = new Map<string, InstanceType<typeof Product>>();
    for (const it of productItems) {
      const prod = await Product.findOne({
        _id: it.refId,
        establishment: establishmentId,
        active: true,
      });
      if (!prod) {
        res.status(404).json({ message: `Produto não encontrado: ${it.name}` });
        return;
      }
      if (prod.stock < it.qty) {
        res.status(409).json({
          message: `Estoque insuficiente de "${prod.name}" (disponível: ${prod.stock})`,
        });
        return;
      }
      productDocs.set(String(it.refId), prod);
    }

    // ---- cliente / profissional ----
    let client: Types.ObjectId | null = null;
    let clientName =
      typeof body.clientName === "string" ? body.clientName.trim() : "";
    if (
      typeof body.clientId === "string" &&
      Types.ObjectId.isValid(body.clientId)
    ) {
      client = new Types.ObjectId(body.clientId);
      if (!clientName) {
        const u = await User.findById(client).select("name");
        if (u?.name) clientName = u.name;
      }
    }
    const professional =
      typeof body.professionalId === "string" &&
      Types.ObjectId.isValid(body.professionalId)
        ? new Types.ObjectId(body.professionalId)
        : null;

    const dueDate =
      receivable && typeof body.dueDate === "string" && body.dueDate
        ? parseLocalDay(body.dueDate, true)
        : null;

    // descricao amigavel
    const first = items[0].name || "Item";
    const description =
      items.length > 1 ? `${first} +${items.length - 1}` : first;

    const primaryMethod: Method = receivable
      ? "outro"
      : payments.slice().sort((a, b) => b.amount - a.amount)[0].method;

    // baixa de estoque + registro
    const warnings: string[] = [];
    const updatedProducts: { _id: string; name: string; stock: number }[] = [];
    for (const it of productItems) {
      const prod = productDocs.get(String(it.refId))!;
      const stockBefore = prod.stock;
      const stockAfter = stockBefore - it.qty;
      await StockMovement.create({
        establishment: establishmentId,
        product: prod._id,
        type: "saida",
        quantity: it.qty,
        stockBefore,
        stockAfter,
        reason: "Venda no caixa",
        unitCost: 0,
        createdBy: req.userId,
        booking: null,
      });
      prod.stock = stockAfter;
      await prod.save();
      updatedProducts.push({
        _id: String(prod._id),
        name: prod.name,
        stock: stockAfter,
      });
      if (prod.minStock > 0 && stockAfter <= prod.minStock) {
        warnings.push(
          `Estoque de "${prod.name}" atingiu o nível mínimo (${stockAfter}).`
        );
      }
    }

    const movement = await CashMovement.create({
      session: session._id,
      establishment: establishmentId,
      createdBy: req.userId,
      type: "entrada",
      method: primaryMethod,
      amount: total,
      description,
      booking: null,
      professional,
      items,
      payments: receivable ? [] : payments,
      discount,
      fee,
      client,
      clientName,
      receivable,
      paid: false,
      dueDate,
    });

    const totals = await computeTotals(session);
    res
      .status(201)
      .json({ movement, totals, updatedProducts, warnings });
  } catch (err) {
    console.error("registerSale:", err);
    res.status(500).json({ message: "Erro ao registrar a venda" });
  }
};

// POST /api/cash/:establishmentId/movement/:movementId/void  — ESTORNO
// body: { reason }
export const voidMovement = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, movementId } = req.params;
    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }
    const reason =
      typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      res.status(400).json({ message: "Informe o motivo do estorno" });
      return;
    }

    const movement = await CashMovement.findOne({
      _id: movementId,
      establishment: establishmentId,
    });
    if (!movement) {
      res.status(404).json({ message: "Movimento não encontrado" });
      return;
    }
    if (movement.status === "estornado") {
      res.status(409).json({ message: "Movimento já estornado" });
      return;
    }

    // so estorna dentro do caixa AINDA aberto (nao altera relatorios fechados)
    const session = await CashSession.findById(movement.session);
    if (!session || session.status !== "aberto") {
      res.status(409).json({
        message:
          "Só é possível estornar movimentos do caixa aberto. Este pertence a um caixa já fechado.",
      });
      return;
    }

    // devolve o estoque dos produtos da venda
    for (const it of movement.items) {
      if (it.kind === "produto" && it.refId) {
        const prod = await Product.findById(it.refId);
        if (prod) {
          const stockBefore = prod.stock;
          const stockAfter = stockBefore + it.qty;
          await StockMovement.create({
            establishment: establishmentId,
            product: prod._id,
            type: "entrada",
            quantity: it.qty,
            stockBefore,
            stockAfter,
            reason: "Estorno de venda no caixa",
            unitCost: 0,
            createdBy: req.userId,
            booking: null,
          });
          prod.stock = stockAfter;
          await prod.save();
        }
      }
    }

    movement.status = "estornado";
    movement.voidReason = reason;
    movement.voidedBy = new Types.ObjectId(req.userId);
    movement.voidedAt = new Date();
    await movement.save();

    const totals = await computeTotals(session);
    res.json({ movement, totals });
  } catch (err) {
    console.error("voidMovement:", err);
    res.status(500).json({ message: "Erro ao estornar o movimento" });
  }
};

// POST /api/cash/:establishmentId/movement/:movementId/receive  — BAIXA DE FIADO
// body: { payments?: [{ method, amount }] }
export const receiveReceivable = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, movementId } = req.params;
    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }

    const movement = await CashMovement.findOne({
      _id: movementId,
      establishment: establishmentId,
      receivable: true,
    });
    if (!movement) {
      res.status(404).json({ message: "Conta a receber não encontrada" });
      return;
    }
    if (movement.paid) {
      res.status(409).json({ message: "Esta conta já foi recebida" });
      return;
    }
    if (movement.status === "estornado") {
      res.status(409).json({ message: "Movimento estornado" });
      return;
    }

    // o dinheiro entra no caixa aberto ATUAL
    const session = await CashSession.findOne({
      establishment: establishmentId,
      status: "aberto",
    });
    if (!session) {
      res
        .status(409)
        .json({ message: "Abra o caixa para receber uma conta a prazo" });
      return;
    }

    const total = movement.amount;
    const rawPay = Array.isArray(req.body.payments) ? req.body.payments : [];
    let payments = rawPay
      .map((p: Record<string, unknown>) => ({
        method: CASH_METHODS.includes(p.method as Method)
          ? (p.method as Method)
          : "dinheiro",
        amount: round2(Math.max(0, Number(p.amount) || 0)),
      }))
      .filter((p: { amount: number }) => p.amount > 0);
    if (payments.length === 0) payments = [{ method: "dinheiro", amount: total }];

    const paidSum = round2(
      payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0)
    );
    if (Math.abs(paidSum - total) > 0.01) {
      res.status(400).json({
        message: `A soma dos pagamentos não bate com o valor da conta (${total.toFixed(
          2
        )})`,
      });
      return;
    }

    movement.paid = true;
    movement.paidAt = new Date();
    movement.session = session._id; // realiza no caixa atual
    movement.payments = payments as unknown as ICashMovement["payments"];
    movement.method = payments.slice().sort(
      (a: { amount: number }, b: { amount: number }) => b.amount - a.amount
    )[0].method;
    await movement.save();

    const totals = await computeTotals(session);
    res.json({ movement, totals });
  } catch (err) {
    console.error("receiveReceivable:", err);
    res.status(500).json({ message: "Erro ao receber a conta" });
  }
};

// POST /api/cash/:establishmentId/close
// body: { countedAmount, closingNotes?, countedBreakdown? }
export const closeSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { countedAmount, closingNotes, countedBreakdown } = req.body;

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

    // monta as linhas do relatorio (movimentos ATIVOS congelados)
    const nameById = await professionalNameMap(establishmentId);
    const movements = await CashMovement.find({ session: session._id }).sort({
      createdAt: 1,
    });

    const lines = movements
      .filter((m) => counts(m))
      .map((m) => ({
        type: m.type,
        method: m.method,
        amount: m.amount,
        description: m.description || "",
        clientName: m.clientName || "",
        professionalName: m.professional
          ? nameById.get(m.professional.toString()) ?? null
          : null,
        createdAt: m.createdAt,
      }));

    const breakdown = Array.isArray(countedBreakdown)
      ? countedBreakdown
          .map((d: Record<string, unknown>) => ({
            value: Math.max(0, Number(d.value) || 0),
            qty: Math.max(0, Math.floor(Number(d.qty) || 0)),
          }))
          .filter((d: { value: number; qty: number }) => d.value > 0 && d.qty > 0)
      : [];

    const difference = round2(countedAmount - totals.expectedCash);

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
      fees: totals.fees,
      discounts: totals.discounts,
      movementCount: totals.movementCount,
      countedBreakdown: breakdown,
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

// GET /api/cash/:establishmentId/history
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
    const limit = 15;
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

// POST /api/cash/:establishmentId/sell  (compat: venda rápida de 1 produto)
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
    if (!CASH_METHODS.includes(method)) {
      res.status(400).json({ message: "Forma de pagamento invalida" });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      res.status(400).json({ message: "Quantidade invalida" });
      return;
    }

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
    if (product.stock < qty) {
      res.status(409).json({
        message: `Estoque insuficiente (disponivel: ${product.stock})`,
      });
      return;
    }

    const gross = product.price * qty;
    const desconto =
      typeof discount === "number" && discount > 0 ? discount : 0;
    const amount = round2(Math.max(0, gross - desconto));
    if (amount <= 0) {
      res.status(400).json({ message: "Valor da venda invalido" });
      return;
    }

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

    const description = qty > 1 ? `${qty}x ${product.name}` : product.name;
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
      items: [
        {
          kind: "produto",
          refId: product._id,
          name: product.name,
          qty,
          unitPrice: product.price,
          total: round2(product.price * qty),
        },
      ],
      payments: [{ method, amount }],
      discount: desconto,
    });

    const totals = await computeTotals(session);
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

// GET /api/cash/:establishmentId/movements  — lista com filtros (relatórios)
// query: from, to, type, method, professional, q, page
export const listMovements = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }
    const { from, to } = rangeFromQuery(req.query as Record<string, unknown>);

    const q: Record<string, unknown> = {
      establishment: establishmentId,
      createdAt: { $gte: from, $lte: to },
    };
    const type = String(req.query.type || "");
    if (["entrada", "saida", "sangria", "suprimento"].includes(type))
      q.type = type;
    const method = String(req.query.method || "");
    if (CASH_METHODS.includes(method as Method)) q.method = method;
    const professional = String(req.query.professional || "");
    if (Types.ObjectId.isValid(professional))
      q.professional = new Types.ObjectId(professional);
    const search = String(req.query.q || "").trim();
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      q.$or = [{ description: rx }, { clientName: rx }];
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = 50;
    const skip = (page - 1) * limit;

    const [raw, total] = await Promise.all([
      CashMovement.find(q)
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CashMovement.countDocuments(q),
    ]);

    const movements = await attachProfessionalNames(establishmentId, raw);
    res.json({
      movements,
      page,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + raw.length < total,
    });
  } catch (err) {
    console.error("listMovements:", err);
    res.status(500).json({ message: "Erro ao listar movimentos" });
  }
};

// GET /api/cash/:establishmentId/receivables  — fiado em aberto
export const listReceivables = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }
    const raw = await CashMovement.find({
      establishment: establishmentId,
      receivable: true,
      paid: false,
      status: "ativo",
    }).sort({ dueDate: 1, createdAt: 1 });

    const items = raw.map((m) => ({
      _id: String(m._id),
      description: m.description,
      clientName: m.clientName,
      amount: m.amount,
      dueDate: m.dueDate,
      createdAt: m.createdAt,
    }));
    const total = round2(items.reduce((s, i) => s + i.amount, 0));
    res.json({ items, total, count: items.length });
  } catch (err) {
    console.error("listReceivables:", err);
    res.status(500).json({ message: "Erro ao listar contas a receber" });
  }
};

// GET /api/cash/:establishmentId/dashboard?from&to  — painel financeiro (dono)
export const dashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await isOwner(establishmentId, req.userId))) {
      res
        .status(403)
        .json({ message: "Apenas o dono acessa o painel financeiro" });
      return;
    }
    const { from, to } = rangeFromQuery(req.query as Record<string, unknown>);

    const movements = await CashMovement.find({
      establishment: establishmentId,
      createdAt: { $gte: from, $lte: to },
      status: "ativo",
    });

    const nameById = await professionalNameMap(establishmentId);

    const byMethod = { dinheiro: 0, cartao: 0, pix: 0, outro: 0 };
    const byDayMap = new Map<string, number>();
    const byProMap = new Map<string, { name: string; total: number; count: number }>();
    const itemMap = new Map<
      string,
      { name: string; kind: string; qty: number; total: number }
    >();

    let revenue = 0;
    let salesCount = 0;
    let outflow = 0; // saidas + sangrias
    let fees = 0;
    let discounts = 0;

    const dayKey = (d: Date) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(x.getDate()).padStart(2, "0")}`;
    };

    for (const m of movements) {
      if (m.receivable && !m.paid) continue; // fiado em aberto: fora do faturamento

      if (m.type === "entrada") {
        revenue += m.amount;
        salesCount += 1;
        fees += m.fee || 0;
        discounts += m.discount || 0;
        byDayMap.set(dayKey(m.createdAt), round2((byDayMap.get(dayKey(m.createdAt)) || 0) + m.amount));

        for (const p of paymentsOf(m)) byMethod[p.method] += p.amount;

        const pid = m.professional ? String(m.professional) : "__none__";
        const row = byProMap.get(pid) || {
          name: m.professional
            ? nameById.get(pid) || "Profissional removido"
            : "Sem profissional",
          total: 0,
          count: 0,
        };
        row.total += m.amount;
        row.count += 1;
        byProMap.set(pid, row);

        if (m.items && m.items.length > 0) {
          for (const it of m.items) {
            const key = `${it.kind}:${it.name}`;
            const row2 = itemMap.get(key) || {
              name: it.name || "Item",
              kind: it.kind,
              qty: 0,
              total: 0,
            };
            row2.qty += it.qty;
            row2.total += it.total;
            itemMap.set(key, row2);
          }
        }
      } else if (m.type === "saida" || m.type === "sangria") {
        outflow += m.amount;
      }
    }

    const byDay = Array.from(byDayMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byProfessional = Array.from(byProMap.values())
      .map((r) => ({ ...r, total: round2(r.total) }))
      .sort((a, b) => b.total - a.total);

    const topItems = Array.from(itemMap.values())
      .map((r) => ({ ...r, total: round2(r.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    // contas a receber em aberto (independe do período)
    const openRec = await CashMovement.find({
      establishment: establishmentId,
      receivable: true,
      paid: false,
      status: "ativo",
    }).select("amount");
    const receivablesTotal = round2(
      openRec.reduce((s, m) => s + m.amount, 0)
    );

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      revenue: round2(revenue),
      netRevenue: round2(revenue - fees),
      salesCount,
      ticket: salesCount > 0 ? round2(revenue / salesCount) : 0,
      outflow: round2(outflow),
      fees: round2(fees),
      discounts: round2(discounts),
      byMethod: {
        dinheiro: round2(byMethod.dinheiro),
        cartao: round2(byMethod.cartao),
        pix: round2(byMethod.pix),
        outro: round2(byMethod.outro),
      },
      byDay,
      byProfessional,
      topItems,
      receivables: { total: receivablesTotal, count: openRec.length },
    });
  } catch (err) {
    console.error("dashboard:", err);
    res.status(500).json({ message: "Erro ao gerar o painel" });
  }
};

// GET /api/cash/:establishmentId/movement/:movementId/receipt  — recibo PDF
export const movementReceipt = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, movementId } = req.params;
    if (!(await canOperate(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao para operar o caixa" });
      return;
    }
    const [movement, est] = await Promise.all([
      CashMovement.findOne({ _id: movementId, establishment: establishmentId }),
      Establishment.findById(establishmentId).select("name address phone"),
    ]);
    if (!movement) {
      res.status(404).json({ message: "Movimento não encontrado" });
      return;
    }

    const a = est?.address;
    const addressLine = a
      ? [
          [a.street, a.number].filter(Boolean).join(", "),
          a.neighborhood,
          [a.city, a.state].filter(Boolean).join("/"),
        ]
          .filter(Boolean)
          .join(" - ")
      : "";

    const nameById = await professionalNameMap(establishmentId);
    const professionalName = movement.professional
      ? nameById.get(String(movement.professional)) || ""
      : "";

    const pdf = await generateCashReceiptPdf({
      establishmentName: est?.name || "",
      addressLine,
      phone: est?.phone,
      date: movement.createdAt,
      clientName: movement.clientName,
      professionalName,
      items: movement.items.map((it) => ({
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        total: it.total,
      })),
      discount: movement.discount || 0,
      fee: movement.fee || 0,
      total: movement.amount,
      payments: (movement.payments && movement.payments.length > 0
        ? movement.payments.map((p) => ({ method: p.method, amount: p.amount }))
        : [{ method: movement.method, amount: movement.amount }]),
      receivable: movement.receivable,
      paid: movement.paid,
      description: movement.description,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="recibo-${String(movement._id).slice(-6)}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("movementReceipt:", err);
    res.status(500).json({ message: "Erro ao gerar o recibo" });
  }
};
