import { Router } from "express";
import {
  getOdontogram,
  setTooth,
  getStatuses,
  setStatuses,
} from "../controllers/odontogramController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";
import { audit } from "../middleware/auditMiddleware";

const router = Router();

// modulo "odontograma" (extra da categoria Odontologia). requireModule usa o
// :establishmentId e a categoria do estabelecimento para liberar.
const mod = requireModule("odontograma");
const log = audit("odontograma");

// configuracao dos status (personalizacao por clinica) — NAO e dado de paciente,
// entao nao passa pelo audit.
// IMPORTANTE: precisa vir ANTES de "/:establishmentId/:clientId", senao o
// Express casaria "statuses" como se fosse um :clientId.
router.get("/:establishmentId/statuses", protect, mod, getStatuses);
router.put("/:establishmentId/statuses", protect, mod, setStatuses);

// odontograma do paciente (auditado)
router.get("/:establishmentId/:clientId", protect, mod, log, getOdontogram);
router.put("/:establishmentId/:clientId/tooth", protect, mod, log, setTooth);

export default router;
