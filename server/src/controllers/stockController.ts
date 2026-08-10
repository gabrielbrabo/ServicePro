import { Response } from "express";
import { StockMovement } from "../models/StockMovement";
import { Product } from "../models/Product";
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
  });
  return !!est;
};

// GET /api/stock/:establishmentId/:productId  (protegido, dono/equipe)
// historico de movimentacoes de um produto
export const listMovements = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, productId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "50"), 10))
    );

    const movements = await StockMovement.find({
      establishment: establishmentId,
      product: productId,
    })
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(movements);
  } catch (err) {
    console.error("listMovements:", err);
    res.status(500).json({ message: "Erro ao listar movimentacoes" });
  }
};

// POST /api/stock/:establishmentId/:productId  (protegido, dono/equipe)
// body: { type, quantity, reason?, unitCost? }
//
// entrada: soma quantity ao estoque
// saida: subtrai quantity (permite negativo, mas avisa na resposta)
// inventario: define o estoque como quantity (ajuste por contagem)
export const createMovement = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, productId } = req.params;
    const { type, quantity, reason, unitCost } = req.body;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    if (!["entrada", "saida", "inventario"].includes(type)) {
      res.status(400).json({ message: "Tipo de movimentacao invalido" });
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      res.status(400).json({ message: "Quantidade invalida" });
      return;
    }
    if (type !== "inventario" && qty === 0) {
      res.status(400).json({ message: "Quantidade deve ser maior que zero" });
      return;
    }

    const product = await Product.findOne({
      _id: productId,
      establishment: establishmentId,
    });
    if (!product) {
      res.status(404).json({ message: "Produto nao encontrado" });
      return;
    }

    const stockBefore = product.stock;
    let stockAfter = stockBefore;

    if (type === "entrada") {
      stockAfter = stockBefore + qty;
    } else if (type === "saida") {
      stockAfter = stockBefore - qty;
    } else {
      // inventario: quantity e o valor contado (novo saldo absoluto)
      stockAfter = qty;
    }

    const movement = await StockMovement.create({
      establishment: establishmentId,
      product: product._id,
      type,
      quantity: qty,
      stockBefore,
      stockAfter,
      reason: reason || "",
      unitCost:
        typeof unitCost === "number" && unitCost >= 0 ? unitCost : 0,
      createdBy: req.userId,
      booking: null,
    });

    // atualiza o saldo do produto
    product.stock = stockAfter;
    // entrada com custo informado atualiza o custo de referencia do produto
    if (type === "entrada" && typeof unitCost === "number" && unitCost > 0) {
      product.cost = unitCost;
    }
    await product.save();

    // avisos (nao impedem a operacao)
    const warnings: string[] = [];
    if (stockAfter < 0) {
      warnings.push("O estoque ficou negativo.");
    } else if (product.minStock > 0 && stockAfter <= product.minStock) {
      warnings.push("O estoque atingiu o nivel minimo.");
    }

    res.status(201).json({ movement, product, warnings });
  } catch (err) {
    console.error("createMovement:", err);
    res.status(500).json({ message: "Erro ao registrar movimentacao" });
  }
};

// GET /api/stock/:establishmentId  (protegido, dono/equipe)
// movimentacoes recentes de todos os produtos (visao geral)
export const listAllMovements = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const limit = Math.min(
      200,
      Math.max(1, parseInt(String(req.query.limit || "50"), 10))
    );

    const movements = await StockMovement.find({
      establishment: establishmentId,
    })
      .populate("product", "name photo")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(movements);
  } catch (err) {
    console.error("listAllMovements:", err);
    res.status(500).json({ message: "Erro ao listar movimentacoes" });
  }
};