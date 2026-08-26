import { Router } from "express";
import {
  listEvolutions,
  createEvolution,
  updateEvolution,
  deleteEvolution,
} from "../controllers/evolutionController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";
import { audit } from "../middleware/auditMiddleware";

const router = Router();

// Evolucao clinica (SOAP) faz parte do prontuario -> modulo "prontuario"
// (area Saude). Todas as rotas tem :establishmentId (requireModule) e
// :clientId (para a auditoria LGPD registrar o paciente). Auditada como
// recurso "prontuario".
const mod = requireModule("prontuario");
const log = audit("prontuario");

router.get("/:establishmentId/:clientId", protect, mod, log, listEvolutions);
router.post("/:establishmentId/:clientId", protect, mod, log, createEvolution);
router.put(
  "/:establishmentId/:clientId/:evolutionId",
  protect,
  mod,
  log,
  updateEvolution
);
router.delete(
  "/:establishmentId/:clientId/:evolutionId",
  protect,
  mod,
  log,
  deleteEvolution
);

export default router;
