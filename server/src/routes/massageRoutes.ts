import { Router } from "express";
import {
  getAssessment,
  updateAssessment,
  listSessions,
  addSession,
  deleteSession,
} from "../controllers/massageController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// extra da categoria massagem (modulo "massagem")
const mod = requireModule("massagem");

router.get("/:establishmentId/:clientId/assessment", protect, mod, getAssessment);
router.put(
  "/:establishmentId/:clientId/assessment",
  protect,
  mod,
  updateAssessment
);
router.get("/:establishmentId/:clientId/sessions", protect, mod, listSessions);
router.post("/:establishmentId/:clientId/sessions", protect, mod, addSession);
router.delete(
  "/:establishmentId/:clientId/sessions/:sessionId",
  protect,
  mod,
  deleteSession
);

export default router;
