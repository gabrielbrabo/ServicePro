import { Router } from "express";
import {
  getConfig,
  setConfig,
  getReport,
} from "../controllers/commissionController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// modulo "comissoes" (comum a todas as areas). O controller ainda restringe
// ao DONO do estabelecimento (dados financeiros).
const mod = requireModule("comissoes");

router.get("/:establishmentId/config", protect, mod, getConfig);
router.put("/:establishmentId/config", protect, mod, setConfig);
router.get("/:establishmentId/report", protect, mod, getReport);

export default router;