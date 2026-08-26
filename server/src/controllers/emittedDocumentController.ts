import { Response } from "express";
import { EmittedDocument } from "../models/EmittedDocument";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import {
  generateDocumentPdf,
  documentTitle,
  DocPdfInput,
  DocType,
  ReceitaType,
} from "../utils/documentPdf";
import {
  requestSignature,
  verifyWebhook,
  parseWebhookEvent,
  signingConfigured,
  getEnvelopeStatus,
  getSignedFileUrl,
} from "../utils/signing";
import { Types } from "mongoose";

const DOC_TYPES = new Set<string>([
  "atestado",
  "declaracao",
  "receita",
  "pedido_exame",
]);

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

// POST /api/documents/:establishmentId/:clientId
// body: { type, patientName?, issuerName?, council?, summary? }
export const logDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const type = String(req.body.type || "");
    if (!DOC_TYPES.has(type)) {
      res.status(400).json({ message: "Tipo de documento invalido" });
      return;
    }

    const str = (v: unknown): string | undefined =>
      typeof v === "string" && v.trim() ? v.trim() : undefined;

    const doc = await EmittedDocument.create({
      establishment: establishmentId,
      client: clientId,
      issuer: req.userId,
      type,
      patientName: str(req.body.patientName),
      issuerName: str(req.body.issuerName),
      council: str(req.body.council),
      summary: str(req.body.summary),
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("logDocument:", err);
    res.status(500).json({ message: "Erro ao registrar o documento" });
  }
};

// monta o input do PDF a partir do corpo da requisicao (dados vindos do front)
const buildPdfInput = (body: Record<string, unknown>): DocPdfInput | null => {
  const type = String(body.type || "");
  if (!DOC_TYPES.has(type)) return null;
  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  const meds = Array.isArray(body.meds)
    ? body.meds
        .map((m) => {
          const o = (m || {}) as Record<string, unknown>;
          return {
            name: String(o.name ?? "").trim(),
            instructions: String(o.instructions ?? "").trim(),
          };
        })
        .filter((m) => m.name)
    : [];
  const exams = Array.isArray(body.exams)
    ? body.exams.map((e) => String(e ?? "").trim()).filter(Boolean)
    : [];
  return {
    type: type as DocType,
    establishmentName: String(body.establishmentName ?? "").trim() || "—",
    addressLine: str(body.addressLine),
    phone: str(body.phone),
    patientName: String(body.patientName ?? "").trim() || "Paciente",
    issuer: str(body.issuer),
    council: str(body.council),
    city: str(body.city),
    dateYMD: str(body.dateYMD),
    days: str(body.days),
    cid: str(body.cid),
    startTime: str(body.startTime),
    endTime: str(body.endTime),
    receitaType: (str(body.receitaType) as ReceitaType) || "comum",
    meds,
    exams,
    examIndication: str(body.examIndication),
  };
};

// POST /api/documents/:establishmentId/:clientId/pdf  (protegido, dono/equipe)
// gera o PDF do documento e devolve o arquivo para download/assinatura.
export const generateDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const input = buildPdfInput(req.body || {});
    if (!input) {
      res.status(400).json({ message: "Tipo de documento invalido" });
      return;
    }
    const pdf = await generateDocumentPdf(input);
    const name = `${documentTitle(input)} - ${input.patientName}`
      .replace(/[^\w\s.-]/g, "")
      .trim();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${name || "documento"}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("generateDocument:", err);
    res.status(500).json({ message: "Erro ao gerar o PDF" });
  }
};

// POST /api/documents/:establishmentId/:clientId/sign  (protegido, dono/equipe)
// gera o PDF e envia para assinatura digital (Clicksign). Cria o registro do
// documento com status "pendente"; o webhook marca "assinado" depois.
export const signDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    if (!signingConfigured()) {
      res
        .status(503)
        .json({ message: "Assinatura digital ainda nao configurada" });
      return;
    }
    const input = buildPdfInput(req.body || {});
    if (!input) {
      res.status(400).json({ message: "Tipo de documento invalido" });
      return;
    }
    const str = (v: unknown): string =>
      typeof v === "string" ? v.trim() : "";
    const signerName = str(req.body.signerName) || input.issuer || "Profissional";
    const signerEmail = str(req.body.signerEmail);
    if (!signerEmail) {
      res
        .status(400)
        .json({ message: "Informe o e-mail do profissional que vai assinar" });
      return;
    }

    const pdf = await generateDocumentPdf(input);
    const title = documentTitle(input);
    const nameBase = `${title} - ${input.patientName}`
      .replace(/[^\w\s.-]/g, "")
      .trim();

    let result;
    try {
      result = await requestSignature({
        pdf,
        filename: `${nameBase || "documento"}.pdf`,
        documentName: nameBase || title,
        signerName,
        signerEmail,
      });
    } catch (err) {
      console.error("requestSignature:", err);
      res
        .status(502)
        .json({ message: "Falha ao enviar o documento para assinatura" });
      return;
    }

    const doc = await EmittedDocument.create({
      establishment: establishmentId,
      client: clientId,
      issuer: req.userId,
      type: input.type,
      patientName: input.patientName,
      issuerName: signerName,
      council: input.council,
      summary: str(req.body.summary) || undefined,
      signatureStatus: "pendente",
      signatureProvider: result.provider,
      signatureRequestId: result.requestId,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("signDocument:", err);
    res.status(500).json({ message: "Erro ao solicitar a assinatura" });
  }
};

// GET /api/documents/:establishmentId/:clientId/:docId/refresh-signature
// pergunta ao Clicksign se o documento ja foi assinado e atualiza o status.
// Alternativa ao webhook (nao precisa de ngrok em dev).
export const refreshSignatureStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, docId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    if (!Types.ObjectId.isValid(docId)) {
      res.status(400).json({ message: "Documento invalido" });
      return;
    }
    const doc = await EmittedDocument.findOne({
      _id: docId,
      establishment: establishmentId,
      client: clientId,
    });
    if (!doc) {
      res.status(404).json({ message: "Documento nao encontrado" });
      return;
    }
    if (!doc.signatureRequestId || !signingConfigured()) {
      res.json(doc);
      return;
    }
    try {
      const st = await getEnvelopeStatus(doc.signatureRequestId);
      if (st.signed) {
        let changed = false;
        if (doc.signatureStatus !== "assinado") {
          doc.signatureStatus = "assinado";
          changed = true;
        }
        // o PDF assinado e buscado sob demanda (link expira); limpa link antigo
        if (doc.signedUrl) {
          doc.signedUrl = undefined;
          changed = true;
        }
        if (!doc.signedAt) {
          doc.signedAt = new Date();
          changed = true;
        }
        if (changed) await doc.save();
      }
    } catch (err) {
      console.error("getEnvelopeStatus:", err);
      res.status(502).json({ message: "Nao foi possivel consultar o status" });
      return;
    }
    res.json(doc);
  } catch (err) {
    console.error("refreshSignatureStatus:", err);
    res.status(500).json({ message: "Erro ao atualizar o status" });
  }
};

// GET /api/documents/:establishmentId/:clientId/:docId/signed-pdf
// devolve uma URL FRESCA (valida por poucos minutos) do PDF assinado.
export const signedPdfUrl = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, docId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    if (!Types.ObjectId.isValid(docId)) {
      res.status(400).json({ message: "Documento invalido" });
      return;
    }
    const doc = await EmittedDocument.findOne({
      _id: docId,
      establishment: establishmentId,
      client: clientId,
    });
    if (!doc || !doc.signatureRequestId || !signingConfigured()) {
      res.status(404).json({ message: "Documento sem assinatura" });
      return;
    }
    const url = await getSignedFileUrl(doc.signatureRequestId);
    if (!url) {
      res
        .status(404)
        .json({ message: "PDF assinado ainda nao disponivel" });
      return;
    }
    res.json({ url });
  } catch (err) {
    console.error("signedPdfUrl:", err);
    res.status(502).json({ message: "Nao foi possivel obter o PDF assinado" });
  }
};

// POST /api/documents/webhook/signing  (PUBLICO — chamado pelo Clicksign)
// valida a assinatura HMAC e marca o documento como assinado.
export const signingWebhook = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    const header =
      (req.headers["content-hmac"] as string) ||
      (req.headers["x-clicksign-signature"] as string) ||
      undefined;

    // LOG temporario (fase de validacao no sandbox): mostra o cabecalho HMAC e o
    // payload, para confirmar o nome do header e o formato do evento. Remover
    // depois de validado.
    console.log(
      "[webhook] headers:",
      Object.keys(req.headers).join(", "),
      "| hmac:",
      header
    );
    console.log(
      "[webhook] body:",
      JSON.stringify(req.body || {}).slice(0, 1500)
    );

    if (raw && !verifyWebhook(raw, header)) {
      res.status(401).json({ message: "Assinatura do webhook invalida" });
      return;
    }

    const evt = parseWebhookEvent(req.body);
    console.log("[webhook] parsed:", JSON.stringify(evt));
    if (evt.requestId && evt.signed) {
      await EmittedDocument.updateOne(
        { signatureRequestId: evt.requestId },
        {
          $set: {
            signatureStatus: "assinado",
            signedUrl: evt.signedUrl,
            signedAt: new Date(),
          },
        }
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("signingWebhook:", err);
    // responde 200 para o provedor nao ficar reenviando indefinidamente
    res.json({ ok: false });
  }
};

// GET /api/documents/:establishmentId/:clientId
// historico de um paciente (mais novo primeiro)
export const listPatientDocuments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const docs = await EmittedDocument.find({
      establishment: establishmentId,
      client: clientId,
    })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(docs);
  } catch (err) {
    console.error("listPatientDocuments:", err);
    res.status(500).json({ message: "Erro ao buscar o historico" });
  }
};

// GET /api/documents/:establishmentId
// auditoria: todos os documentos do estabelecimento (mais novo primeiro).
// aceita ?type= e ?limit= opcionais.
export const listEstablishmentDocuments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const filter: Record<string, unknown> = { establishment: establishmentId };
    const type = String(req.query.type || "");
    if (DOC_TYPES.has(type)) filter.type = type;

    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const docs = await EmittedDocument.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(docs);
  } catch (err) {
    console.error("listEstablishmentDocuments:", err);
    res.status(500).json({ message: "Erro ao buscar os documentos" });
  }
};