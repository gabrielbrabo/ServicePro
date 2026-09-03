import { Router } from "express";
import {
  getProfile,
  updateProfile,
  listAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  listWorkouts,
  createWorkout,
  updateWorkout,
  deleteWorkout,
  workoutPdf,
} from "../controllers/personalController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// modulo "personal" (extra da categoria personal-trainer). Todas as rotas tem
// :establishmentId (requireModule) e :clientId (aluno).
const mod = requireModule("personal");

// ficha / perfil do aluno
router.get("/:establishmentId/:clientId/profile", protect, mod, getProfile);
router.put("/:establishmentId/:clientId/profile", protect, mod, updateProfile);

// avaliacoes fisicas (com medidas)
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

// fichas de treino
router.get("/:establishmentId/:clientId/workouts", protect, mod, listWorkouts);
router.post(
  "/:establishmentId/:clientId/workouts",
  protect,
  mod,
  createWorkout
);
router.put(
  "/:establishmentId/:clientId/workouts/:workoutId",
  protect,
  mod,
  updateWorkout
);
router.delete(
  "/:establishmentId/:clientId/workouts/:workoutId",
  protect,
  mod,
  deleteWorkout
);
router.get(
  "/:establishmentId/:clientId/workouts/:workoutId/pdf",
  protect,
  mod,
  workoutPdf
);

export default router;
