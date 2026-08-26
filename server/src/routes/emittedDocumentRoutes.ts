import { Router } from "express";
import {
  logDocument,
  listPatientDocuments,
  listEstablishmentDocuments,
  generateDocument,
  signDocument,
  signingWebhook,
  refreshSignatureStatus,
  signedPdfUrl,
} from "../controllers/emittedDocumentController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";
import { audit } from "../middleware/auditMiddleware";

const router = Router();

// mesmo modulo do gerador de documentos ("documentos", liberado na area Saude)
const mod = requireModule("documentos");
const log = audit("documento");

// webhook do provedor de assinatura (PUBLICO). Vem ANTES das rotas com
// :establishmentId para nao ser capturado por elas.
router.post("/webhook/signing", signingWebhook);

// historico de um paciente + registrar emissao (auditado)
router.get("/:establishmentId/:clientId", protect, mod, log, listPatientDocuments);
router.post("/:establishmentId/:clientId", protect, mod, log, logDocument);

// gera o PDF do documento (download/assinatura)
router.post("/:establishmentId/:clientId/pdf", protect, mod, log, generateDocument);

// envia o documento para assinatura digital
router.post("/:establishmentId/:clientId/sign", protect, mod, log, signDocument);

// consulta o status da assinatura (alternativa ao webhook, sem ngrok)
router.get(
  "/:establishmentId/:clientId/:docId/refresh-signature",
  protect,
  mod,
  log,
  refreshSignatureStatus
);

// URL fresca do PDF assinado (gerada na hora; o link expira)
router.get(
  "/:establishmentId/:clientId/:docId/signed-pdf",
  protect,
  mod,
  log,
  signedPdfUrl
);

// auditoria: todos do estabelecimento (rota mais curta vem por ultimo)
router.get("/:establishmentId", protect, mod, log, listEstablishmentDocuments);

export default router;
