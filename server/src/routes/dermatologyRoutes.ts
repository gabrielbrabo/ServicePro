import { Router } from "express";
import {
  getProfile,
  updateProfile,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
} from "../controllers/dermatologyController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// modulo "dermatologia" (extra da categoria dermatologia). Todas as rotas tem
// :establishmentId (requireModule) e :clientId (paciente).
const mod = requireModule("dermatologia");

router.get("/:establishmentId/:clientId/profile", protect, mod, getProfile);
router.put("/:establishmentId/:clientId/profile", protect, mod, updateProfile);

router.get("/:establishmentId/:clientId/sessions", protect, mod, listSessions);
router.post(
  "/:establishmentId/:clientId/sessions",
  protect,
  mod,
  createSession
);
router.put(
  "/:establishmentId/:clientId/sessions/:sessionId",
  protect,
  mod,
  updateSession
);
router.delete(
  "/:establishmentId/:clientId/sessions/:sessionId",
  protect,
  mod,
  deleteSession
);

export default router;
