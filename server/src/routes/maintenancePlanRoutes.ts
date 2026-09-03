import { Router } from "express";
import {
  listPlans,
  createPlan,
  updatePlan,
  scheduleVisits,
  unscheduleVisits,
  deletePlan,
} from "../controllers/maintenancePlanController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// plano de manutencao recorrente: extra da categoria jardinagem-paisagismo
// (modulo "manutencao")
const mod = requireModule("manutencao");

router.get("/:establishmentId", protect, mod, listPlans);
router.post("/:establishmentId", protect, mod, createPlan);
router.put("/:establishmentId/:id", protect, mod, updatePlan);
// agenda: gera / cancela as visitas recorrentes
router.post("/:establishmentId/:id/schedule", protect, mod, scheduleVisits);
router.post("/:establishmentId/:id/unschedule", protect, mod, unscheduleVisits);
router.delete("/:establishmentId/:id", protect, mod, deletePlan);

export default router;
