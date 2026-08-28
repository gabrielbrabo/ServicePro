import { Router } from "express";
import {
  getAssessment,
  updateAssessment,
  listApplications,
  addApplication,
  deleteApplication,
} from "../controllers/aestheticController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// extra da categoria estetica (modulo "estetica")
const mod = requireModule("estetica");

router.get(
  "/:establishmentId/:clientId/assessment",
  protect,
  mod,
  getAssessment
);
router.put(
  "/:establishmentId/:clientId/assessment",
  protect,
  mod,
  updateAssessment
);
router.get(
  "/:establishmentId/:clientId/applications",
  protect,
  mod,
  listApplications
);
router.post(
  "/:establishmentId/:clientId/applications",
  protect,
  mod,
  addApplication
);
router.delete(
  "/:establishmentId/:clientId/applications/:appId",
  protect,
  mod,
  deleteApplication
);

export default router;
