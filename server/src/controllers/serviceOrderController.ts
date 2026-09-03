import { Response } from "express";
import {
  ServiceOrder,
  computeOrderTotal,
  ServiceOrderStatus,
} from "../models/ServiceOrder";
import { Establishment } from "../models/Establishment";
import { CashSession } from "../models/CashSession";
import { CashMovement } from "../models/CashMovement";
import { AuthRequest } from "../middleware/auth";
import { generateServiceOrderPdf } from "../utils/serviceOrderPdf";
import { Types } from "mongoose";

const CASH_METHODS = ["dinheiro", "cartao", "pix", "outro"];

// Lanca o total da OS como ENTRADA no caixa aberto quando ela vira "entregue".
// Respeita o auto-lancamento do estabelecimento; nao repete (postedToCash).
async function maybePostToCash(
  order: InstanceType<typeof ServiceOrder>,
  userId?: string
): Promise<void> {
  if (order.status !== "entregue" || order.postedToCash || !(order.total > 0))
    return;
  const est = await Establishment.findById(order.establishment).select(
    "cashAutoEntry"
  );
  if (est?.cashAutoEntry === false) return;
  const session = await CashSession.findOne({
    establishment: order.establishment,
    status: "aberto",
  });
  if (!session) return; // sem caixa aberto: nao lanca
  const method = CASH_METHODS.includes(order.paymentMethod)
    ? order.paymentMethod
    : "dinheiro";
  await CashMovement.create({
    session: session._id,
    establishment: order.establishment,
    createdBy: userId,
    type: "entrada",
    method,
    amount: order.total,
    description: `OS #${order.number}${order.title ? " - " + order.title : ""}`,
    professional: order.professional ?? null,
  });
  order.postedToCash = true;
  await order.save();
}

const STATUS_LABEL: Record<string, string> = {
  orcamento: "Orçamento",
  aprovado: "Aprovado",
  em_execucao: "Em execução",
  concluido: "Concluído",
  entregue: "Entregue",
  cancelado: "Cancelado",
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

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";
const clampNum = (v: unknown): number => Math.max(0, Number(v) || 0);

const STATUSES: ServiceOrderStatus[] = [
  "orcamento",
  "aprovado",
  "em_execucao",
  "concluido",
  "entregue",
  "cancelado",
];
const sanitizeStatus = (v: unknown): ServiceOrderStatus =>
  STATUSES.includes(v as ServiceOrderStatus)
    ? (v as ServiceOrderStatus)
    : "orcamento";

// normaliza a lista de pecas/materiais
const sanitizeParts = (
  raw: unknown
): { description: string; qty: number; unitPrice: number }[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => ({
      description: cleanText((p as { description?: unknown })?.description),
      qty: Math.max(0, Number((p as { qty?: unknown })?.qty) || 0),
      unitPrice: clampNum((p as { unitPrice?: unknown })?.unitPrice),
    }))
    .filter((p) => p.description !== "" || p.qty > 0 || p.unitPrice > 0);
};

const sanitizeUrls = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

// dados do veiculo (extra automotivo)
const sanitizeVehicle = (raw: unknown) => {
  const v = (raw || {}) as Record<string, unknown>;
  return {
    plate: cleanText(v.plate),
    brand: cleanText(v.brand),
    model: cleanText(v.model),
    year: Math.max(0, Math.floor(Number(v.year) || 0)),
    km: Math.max(0, Math.floor(Number(v.km) || 0)),
    color: cleanText(v.color),
    nextRevisionKm: Math.max(0, Math.floor(Number(v.nextRevisionKm) || 0)),
    nextRevisionDate: cleanText(v.nextRevisionDate),
  };
};

// dados do equipamento (extra assistencia tecnica)
const sanitizeEquipment = (raw: unknown) => {
  const e = (raw || {}) as Record<string, unknown>;
  return {
    brand: cleanText(e.brand),
    model: cleanText(e.model),
    serial: cleanText(e.serial),
    accessories: cleanText(e.accessories),
    condition: cleanText(e.condition),
  };
};

// termo de garantia (refrigeracao / eletrica-hidraulica)
const sanitizeWarranty = (raw: unknown) => {
  const w = (raw || {}) as Record<string, unknown>;
  return {
    coverage: cleanText(w.coverage),
    exclusions: cleanText(w.exclusions),
  };
};

// certificado de dedetizacao
const sanitizePestControl = (raw: unknown) => {
  const p = (raw || {}) as Record<string, unknown>;
  return {
    targetPest: cleanText(p.targetPest),
    products: cleanText(p.products),
    method: cleanText(p.method),
    nextApplication: cleanText(p.nextApplication),
    technician: cleanText(p.technician),
  };
};

// ficha de medidas (costura / ajustes)
const sanitizeMeasureItems = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((i) => {
          const it = (i || {}) as Record<string, unknown>;
          return { name: cleanText(it.name), value: cleanText(it.value) };
        })
        .filter((i) => i.name !== "" || i.value !== "")
    : [];
const sanitizeMeasurements = (raw: unknown) => {
  const m = (raw || {}) as Record<string, unknown>;
  return {
    garment: cleanText(m.garment),
    fabric: cleanText(m.fabric),
    fittingDate: cleanText(m.fittingDate),
    items: sanitizeMeasureItems(m.items),
    notes: cleanText(m.notes),
  };
};

const INSPECTION_STATUS = ["ok", "atencao", "troca", "na"];
const sanitizeInspection = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((i) => {
          const it = (i || {}) as Record<string, unknown>;
          const status = String(it.status);
          return {
            item: cleanText(it.item),
            status: (INSPECTION_STATUS.includes(status) ? status : "na") as
              | "ok"
              | "atencao"
              | "troca"
              | "na",
            note: cleanText(it.note),
          };
        })
        .filter((i) => i.item !== "")
    : [];

// monta o payload comum (create/update) a partir do body
const buildPayload = (body: Record<string, unknown>) => {
  const parts = sanitizeParts(body.parts);
  const laborCost = clampNum(body.laborCost);
  const discount = clampNum(body.discount);
  return {
    clientName: cleanText(body.clientName),
    clientPhone: cleanText(body.clientPhone),
    professional:
      typeof body.professional === "string" &&
      Types.ObjectId.isValid(body.professional)
        ? new Types.ObjectId(body.professional)
        : null,
    title: cleanText(body.title),
    object: cleanText(body.object),
    reportedProblem: cleanText(body.reportedProblem),
    diagnosis: cleanText(body.diagnosis),
    parts,
    laborCost,
    discount,
    total: computeOrderTotal({ parts, laborCost, discount }),
    status: sanitizeStatus(body.status),
    warrantyDays: Math.floor(clampNum(body.warrantyDays)),
    warrantyNote: cleanText(body.warrantyNote),
    photosBefore: sanitizeUrls(body.photosBefore),
    photosAfter: sanitizeUrls(body.photosAfter),
    notes: cleanText(body.notes),
    vehicle: sanitizeVehicle(body.vehicle),
    inspection: sanitizeInspection(body.inspection),
    equipment: sanitizeEquipment(body.equipment),
    technicalReport: cleanText(body.technicalReport),
    pestControl: sanitizePestControl(body.pestControl),
    warranty: sanitizeWarranty(body.warranty),
    measurements: sanitizeMeasurements(body.measurements),
    paymentMethod: CASH_METHODS.includes(String(body.paymentMethod))
      ? (String(body.paymentMethod) as
          | "dinheiro"
          | "cartao"
          | "pix"
          | "outro")
      : "dinheiro",
  };
};

// GET /api/service-orders/:establishmentId
export const listOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await ServiceOrder.find({ establishment: establishmentId })
      .sort({ number: -1, createdAt: -1 })
      .limit(300);
    res.json(items);
  } catch (err) {
    console.error("listOrders:", err);
    res.status(500).json({ message: "Erro ao listar ordens de servico" });
  }
};

// GET /api/service-orders/:establishmentId/history?plate=XXX
// Historico do veiculo: OS anteriores com a MESMA placa (normalizada: sem
// separadores, maiuscula). Retorna campos resumidos, mais recente primeiro.
const normPlate = (p: unknown): string =>
  String(p || "").replace(/[^a-z0-9]/gi, "").toUpperCase();

export const ordersByPlate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const plate = normPlate((req.query as { plate?: unknown }).plate);
    if (!plate) {
      res.json([]);
      return;
    }
    const items = await ServiceOrder.find({
      establishment: establishmentId,
      "vehicle.plate": { $ne: "" },
    })
      .select("number title object diagnosis status total vehicle createdAt")
      .sort({ number: -1 })
      .limit(300);
    const matched = items.filter((o) => normPlate(o.vehicle?.plate) === plate);
    res.json(matched);
  } catch (err) {
    console.error("ordersByPlate:", err);
    res.status(500).json({ message: "Erro ao buscar historico do veiculo" });
  }
};

// POST /api/service-orders/:establishmentId
export const createOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    // numero sequencial por estabelecimento
    const last = await ServiceOrder.findOne({ establishment: establishmentId })
      .sort({ number: -1 })
      .select("number");
    const number = (last?.number || 0) + 1;

    const order = await ServiceOrder.create({
      establishment: establishmentId,
      number,
      author: req.userId,
      ...buildPayload(req.body),
    });
    await maybePostToCash(order, req.userId);
    res.status(201).json(order);
  } catch (err) {
    console.error("createOrder:", err);
    res.status(500).json({ message: "Erro ao criar ordem de servico" });
  }
};

// PUT /api/service-orders/:establishmentId/:id
export const updateOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const order = await ServiceOrder.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!order) {
      res.status(404).json({ message: "Ordem nao encontrada" });
      return;
    }
    Object.assign(order, buildPayload(req.body));
    await order.save();
    await maybePostToCash(order, req.userId);
    res.json(order);
  } catch (err) {
    console.error("updateOrder:", err);
    res.status(500).json({ message: "Erro ao atualizar ordem de servico" });
  }
};

// GET /api/service-orders/:establishmentId/:id/pdf
export const orderPdf = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const [order, est] = await Promise.all([
      ServiceOrder.findOne({ _id: id, establishment: establishmentId }),
      Establishment.findById(establishmentId).select("name address phone"),
    ]);
    if (!order) {
      res.status(404).json({ message: "Ordem nao encontrada" });
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

    const d = order.createdAt;
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;

    const pdf = await generateServiceOrderPdf({
      establishmentName: est?.name || "",
      addressLine,
      phone: est?.phone,
      number: order.number,
      dateYMD: ymd,
      statusLabel: STATUS_LABEL[order.status] || order.status,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      object: order.object,
      reportedProblem: order.reportedProblem,
      diagnosis: order.diagnosis,
      parts: order.parts.map((p) => ({
        description: p.description,
        qty: p.qty,
        unitPrice: p.unitPrice,
      })),
      laborCost: order.laborCost,
      discount: order.discount,
      total: order.total,
      warrantyDays: order.warrantyDays,
      warrantyNote: order.warrantyNote,
      notes: order.notes,
      vehicle: order.vehicle,
      inspection: order.inspection.map((i) => ({
        item: i.item,
        status: i.status,
        note: i.note,
      })),
      equipment: order.equipment,
      technicalReport: order.technicalReport,
      pestControl: order.pestControl,
      warranty: order.warranty,
      measurements: {
        garment: order.measurements?.garment,
        fabric: order.measurements?.fabric,
        fittingDate: order.measurements?.fittingDate,
        items: (order.measurements?.items || []).map((i) => ({
          name: i.name,
          value: i.value,
        })),
        notes: order.measurements?.notes,
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="OS-${order.number}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("orderPdf:", err);
    res.status(500).json({ message: "Erro ao gerar o PDF" });
  }
};

// DELETE /api/service-orders/:establishmentId/:id
export const deleteOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const deleted = await ServiceOrder.findOneAndDelete({
      _id: id,
      establishment: establishmentId,
    });
    if (!deleted) {
      res.status(404).json({ message: "Ordem nao encontrada" });
      return;
    }
    res.json({ message: "Ordem removida", _id: id });
  } catch (err) {
    console.error("deleteOrder:", err);
    res.status(500).json({ message: "Erro ao remover ordem de servico" });
  }
};
