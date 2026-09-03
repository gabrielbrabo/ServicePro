import { Router } from "express";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
} from "../controllers/lessonPlanController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// plano de aulas + frequencia: extra da categoria aulas-particulares
// (modulo "aulas")
const mod = requireModule("aulas");

router.get("/:establishmentId", protect, mod, listPlans);
router.post("/:establishmentId", protect, mod, createPlan);
router.put("/:establishmentId/:id", protect, mod, updatePlan);
router.delete("/:establishmentId/:id", protect, mod, deletePlan);

export default router;
