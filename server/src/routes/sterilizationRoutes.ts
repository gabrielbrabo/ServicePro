import { Router } from "express";
import {
  listCycles,
  addCycle,
  deleteCycle,
} from "../controllers/sterilizationController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// controle de esterilizacao: extra da categoria manicure-pedicure
// (modulo "esterilizacao")
const mod = requireModule("esterilizacao");

router.get("/:establishmentId", protect, mod, listCycles);
router.post("/:establishmentId", protect, mod, addCycle);
router.delete("/:establishmentId/:cycleId", protect, mod, deleteCycle);

export default router;
