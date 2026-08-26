import { Router } from "express";
import { listAudit } from "../controllers/auditController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// modulo "auditoria" (area Saude). O controller restringe ao DONO.
// Obs.: estas rotas NAO usam o middleware `audit` (nao auditamos quem le a auditoria).
router.get(
  "/:establishmentId",
  protect,
  requireModule("auditoria"),
  listAudit
);

export default router;
