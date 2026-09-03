import { Response } from "express";
import { PhotoJob, PhotoJobStatus } from "../models/PhotoJob";
import { Establishment } from "../models/Establishment";
import { CashSession } from "../models/CashSession";
import { CashMovement } from "../models/CashMovement";
import { AuthRequest } from "../middleware/auth";
import { generatePhotoContractPdf } from "../utils/photoContractPdf";

const CASH_METHODS = ["dinheiro", "cartao", "pix", "outro"];

// Cria UMA entrada no caixa aberto (respeitando o auto-lancamento). Devolve
// true se lancou. Nao seta flags — quem chama controla a idempotencia.
async function postEntry(
  job: InstanceType<typeof PhotoJob>,
  userId: string | undefined,
  amount: number,
  label: string
): Promise<boolean> {
  if (!(amount > 0)) return false;
  const est = await Establishment.findById(job.establishment).select(
    "cashAutoEntry"
  );
  if (est?.cashAutoEntry === false) return false;
  const session = await CashSession.findOne({
    establishment: job.establishment,
    status: "aberto",
  });
  if (!session) return false; // sem caixa aberto: nao lanca (tenta de novo depois)
  const method = CASH_METHODS.includes(job.paymentMethod)
    ? job.paymentMethod
    : "dinheiro";
  await CashMovement.create({
    session: session._id,
    establishment: job.establishment,
    createdBy: userId,
    type: "entrada",
    method,
    amount,
    description: `Foto #${job.number}${
      job.title ? " - " + job.title : ""
    } (${label})`,
    professional: null,
  });
  return true;
}

// Lanca no caixa em duas etapas: SINAL quando o job chega a "contratado" (ou
// alem) e SALDO quando vira "entregue". Cada etapa lanca uma unica vez (flags
// independentes) e so se houver caixa aberto.
async function maybePostToCash(
  job: InstanceType<typeof PhotoJob>,
  userId?: string
): Promise<void> {
  let changed = false;
  const reachedContract = ["contratado", "em_producao", "entregue"].includes(
    job.status
  );
  // SINAL (entrada) — ao contratar
  if (reachedContract && !job.depositPostedToCash && job.deposit > 0) {
    if (await postEntry(job, userId, job.deposit, "sinal")) {
      job.depositPostedToCash = true;
      changed = true;
    }
  }
  // SALDO — na entrega (sem sinal, lanca o total)
  if (job.status === "entregue" && !job.balancePostedToCash) {
    const balance = Math.max(0, job.price - job.deposit);
    const label = job.deposit > 0 ? "saldo" : "total";
    if (balance <= 0) {
      job.balancePostedToCash = true; // nada a lancar, mas ja resolvido
      changed = true;
    } else if (await postEntry(job, userId, balance, label)) {
      job.balancePostedToCash = true;
      changed = true;
    }
  }
  if (changed) await job.save();
}

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

const STATUSES: PhotoJobStatus[] = [
  "orcamento",
  "contratado",
  "em_producao",
  "entregue",
  "cancelado",
];
const sanitizeStatus = (v: unknown): PhotoJobStatus =>
  STATUSES.includes(v as PhotoJobStatus)
    ? (v as PhotoJobStatus)
    : "orcamento";

const PAY = ["dinheiro", "cartao", "pix", "outro"];
const sanitizePay = (v: unknown) =>
  PAY.includes(String(v))
    ? (String(v) as "dinheiro" | "cartao" | "pix" | "outro")
    : "pix";

const buildPayload = (body: Record<string, unknown>) => ({
  clientName: cleanText(body.clientName),
  clientPhone: cleanText(body.clientPhone),
  title: cleanText(body.title),
  eventType: cleanText(body.eventType),
  eventDate: cleanText(body.eventDate),
  eventTime: cleanText(body.eventTime),
  location: cleanText(body.location),
  briefing: cleanText(body.briefing),
  deliverables: cleanText(body.deliverables),
  deliveryDeadline: cleanText(body.deliveryDeadline),
  price: clampNum(body.price),
  deposit: clampNum(body.deposit),
  paymentMethod: sanitizePay(body.paymentMethod),
  contractTerms: cleanText(body.contractTerms),
  status: sanitizeStatus(body.status),
  deliveryLink: cleanText(body.deliveryLink),
  notes: cleanText(body.notes),
});

const STATUS_LABEL: Record<string, string> = {
  orcamento: "Orçamento",
  contratado: "Contratado",
  em_producao: "Em produção",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const PAY_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "PIX",
  outro: "Outro",
};

// GET /api/photo-jobs/:establishmentId
export const listJobs = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await PhotoJob.find({ establishment: establishmentId })
      .sort({ number: -1, createdAt: -1 })
      .limit(300);
    res.json(items);
  } catch (err) {
    console.error("listJobs:", err);
    res.status(500).json({ message: "Erro ao listar jobs" });
  }
};

// POST /api/photo-jobs/:establishmentId
export const createJob = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const last = await PhotoJob.findOne({ establishment: establishmentId })
      .sort({ number: -1 })
      .select("number");
    const number = (last?.number || 0) + 1;
    const job = await PhotoJob.create({
      establishment: establishmentId,
      number,
      author: req.userId,
      ...buildPayload(req.body),
    });
    await maybePostToCash(job, req.userId);
    res.status(201).json(job);
  } catch (err) {
    console.error("createJob:", err);
    res.status(500).json({ message: "Erro ao criar job" });
  }
};

// PUT /api/photo-jobs/:establishmentId/:id
export const updateJob = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const job = await PhotoJob.findOne({
      _id: id,
      establishment: establishmentId,
    });
    if (!job) {
      res.status(404).json({ message: "Job nao encontrado" });
      return;
    }
    Object.assign(job, buildPayload(req.body));
    await job.save();
    await maybePostToCash(job, req.userId);
    res.json(job);
  } catch (err) {
    console.error("updateJob:", err);
    res.status(500).json({ message: "Erro ao atualizar job" });
  }
};

// GET /api/photo-jobs/:establishmentId/:id/pdf
export const jobPdf = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const [job, est] = await Promise.all([
      PhotoJob.findOne({ _id: id, establishment: establishmentId }),
      Establishment.findById(establishmentId).select("name address phone"),
    ]);
    if (!job) {
      res.status(404).json({ message: "Job nao encontrado" });
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

    const d = job.createdAt;
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;

    const pdf = await generatePhotoContractPdf({
      establishmentName: est?.name || "",
      addressLine,
      phone: est?.phone,
      number: job.number,
      dateYMD: ymd,
      statusLabel: STATUS_LABEL[job.status] || job.status,
      clientName: job.clientName,
      clientPhone: job.clientPhone,
      title: job.title,
      eventType: job.eventType,
      eventDate: job.eventDate,
      eventTime: job.eventTime,
      location: job.location,
      briefing: job.briefing,
      deliverables: job.deliverables,
      deliveryDeadline: job.deliveryDeadline,
      deliveryLink: job.deliveryLink,
      price: job.price,
      deposit: job.deposit,
      paymentMethodLabel: PAY_LABEL[job.paymentMethod] || job.paymentMethod,
      contractTerms: job.contractTerms,
      notes: job.notes,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Contrato-${job.number}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("jobPdf:", err);
    res.status(500).json({ message: "Erro ao gerar o PDF" });
  }
};

// DELETE /api/photo-jobs/:establishmentId/:id
export const deleteJob = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, id } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const deleted = await PhotoJob.findOneAndDelete({
      _id: id,
      establishment: establishmentId,
    });
    if (!deleted) {
      res.status(404).json({ message: "Job nao encontrado" });
      return;
    }
    res.json({ message: "Job removido", _id: id });
  } catch (err) {
    console.error("deleteJob:", err);
    res.status(500).json({ message: "Erro ao remover job" });
  }
};
