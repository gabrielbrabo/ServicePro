import { Router } from "express";
import {
  listPackages,
  createPackage,
  updatePackage,
  addPackageUse,
  removePackageUse,
  deletePackage,
  listAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
} from "../controllers/physioController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";
import { audit } from "../middleware/auditMiddleware";

const router = Router();

// modulo "fisioterapia" (extra da categoria fisioterapia). Todas as rotas tem
// :establishmentId (requireModule) e :clientId (auditoria LGPD registra o
// paciente). Auditada como recurso "fisioterapia".
const mod = requireModule("fisioterapia");
const log = audit("fisioterapia");

// pacotes de sessoes
router.get("/:establishmentId/:clientId/packages", protect, mod, log, listPackages);
router.post("/:establishmentId/:clientId/packages", protect, mod, log, createPackage);
router.patch(
  "/:establishmentId/:clientId/packages/:packageId",
  protect,
  mod,
  log,
  updatePackage
);
router.delete(
  "/:establishmentId/:clientId/packages/:packageId",
  protect,
  mod,
  log,
  deletePackage
);
router.post(
  "/:establishmentId/:clientId/packages/:packageId/uses",
  protect,
  mod,
  log,
  addPackageUse
);
router.delete(
  "/:establishmentId/:clientId/packages/:packageId/uses/:useId",
  protect,
  mod,
  log,
  removePackageUse
);

// avaliacoes fisioterapeuticas
router.get(
  "/:establishmentId/:clientId/assessments",
  protect,
  mod,
  log,
  listAssessments
);
router.post(
  "/:establishmentId/:clientId/assessments",
  protect,
  mod,
  log,
  createAssessment
);
router.put(
  "/:establishmentId/:clientId/assessments/:assessmentId",
  protect,
  mod,
  log,
  updateAssessment
);
router.delete(
  "/:establishmentId/:clientId/assessments/:assessmentId",
  protect,
  mod,
  log,
  deleteAssessment
);

export default router;
