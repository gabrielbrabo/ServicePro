import { Router } from "express";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  addItem,
  updateItem,
  deleteItem,
} from "../controllers/treatmentPlanController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";
import { audit } from "../middleware/auditMiddleware";

const router = Router();

// modulo "plano_tratamento" (area Saude). Todas as rotas tem :establishmentId
// para o requireModule conseguir validar a area.
const mod = requireModule("plano_tratamento");
const log = audit("plano_tratamento");

router.get("/:establishmentId/:clientId", protect, mod, log, listPlans);
router.post("/:establishmentId/:clientId", protect, mod, log, createPlan);

router.put("/:establishmentId/plans/:planId", protect, mod, log, updatePlan);
router.delete("/:establishmentId/plans/:planId", protect, mod, log, deletePlan);

router.post("/:establishmentId/plans/:planId/items", protect, mod, log, addItem);
router.patch(
  "/:establishmentId/plans/:planId/items/:itemId",
  protect,
  mod,
  log,
  updateItem
);
router.delete(
  "/:establishmentId/plans/:planId/items/:itemId",
  protect,
  mod,
  log,
  deleteItem
);

export default router;
