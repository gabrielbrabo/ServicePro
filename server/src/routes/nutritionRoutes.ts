import { Router } from "express";
import {
  getProfile,
  updateProfile,
  listAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  planPdf,
} from "../controllers/nutritionController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// modulo "nutricao" (extra da categoria nutricao). Todas as rotas tem
// :establishmentId (requireModule) e :clientId (paciente).
const mod = requireModule("nutricao");

// ficha / perfil + metas do paciente
router.get("/:establishmentId/:clientId/profile", protect, mod, getProfile);
router.put("/:establishmentId/:clientId/profile", protect, mod, updateProfile);

// antropometria (avaliacoes datadas)
router.get(
  "/:establishmentId/:clientId/assessments",
  protect,
  mod,
  listAssessments
);
router.post(
  "/:establishmentId/:clientId/assessments",
  protect,
  mod,
  createAssessment
);
router.put(
  "/:establishmentId/:clientId/assessments/:assessmentId",
  protect,
  mod,
  updateAssessment
);
router.delete(
  "/:establishmentId/:clientId/assessments/:assessmentId",
  protect,
  mod,
  deleteAssessment
);

// planos alimentares
router.get("/:establishmentId/:clientId/plans", protect, mod, listPlans);
router.post("/:establishmentId/:clientId/plans", protect, mod, createPlan);
router.put(
  "/:establishmentId/:clientId/plans/:planId",
  protect,
  mod,
  updatePlan
);
router.delete(
  "/:establishmentId/:clientId/plans/:planId",
  protect,
  mod,
  deletePlan
);
router.get(
  "/:establishmentId/:clientId/plans/:planId/pdf",
  protect,
  mod,
  planPdf
);

export default router;
