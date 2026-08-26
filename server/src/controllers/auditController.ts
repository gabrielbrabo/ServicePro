import { Response } from "express";
import { AuditLog } from "../models/AuditLog";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";

// Auditoria e responsabilidade do controlador de dados: SO O DONO acessa.
const ownerEst = async (establishmentId: string, userId?: string) => {
  if (!userId) return null;
  return Establishment.findOne({ _id: establishmentId, owner: userId }).select(
    "_id"
  );
};

const RESOURCES = new Set([
  "prontuario",
  "odontograma",
  "plano_tratamento",
  "documento",
]);
const ACTIONS = new Set(["view", "create", "update", "delete", "other"]);

// GET /api/audit/:establishmentId
// filtros opcionais: ?client= &resource= &action= &from= &to= &page= &limit=
export const listAudit = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await ownerEst(establishmentId, req.userId))) {
      res.status(403).json({ message: "Apenas o dono acessa a auditoria" });
      return;
    }

    const filter: Record<string, unknown> = { establishment: establishmentId };

    if (typeof req.query.client === "string" && req.query.client) {
      filter.client = req.query.client;
    }
    const resource = String(req.query.resource || "");
    if (RESOURCES.has(resource)) filter.resource = resource;

    const action = String(req.query.action || "");
    if (ACTIONS.has(action)) filter.action = action;

    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) {
        const d = new Date(String(req.query.from));
        d.setHours(0, 0, 0, 0);
        range.$gte = d;
      }
      if (req.query.to) {
        const d = new Date(String(req.query.to));
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
      filter.createdAt = range;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("actor", "name email")
        .populate("client", "name"),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("listAudit:", err);
    res.status(500).json({ message: "Erro ao buscar a auditoria" });
  }
};
