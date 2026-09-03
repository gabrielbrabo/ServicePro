import { Router } from "express";
import {
  getProfile,
  updateProfile,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  sessionPdf,
} from "../controllers/podiatryController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// modulo "podologia" (extra da categoria podologia). Todas as rotas tem
// :establishmentId (requireModule) e :clientId (paciente).
const mod = requireModule("podologia");

// ficha / perfil do paciente
router.get("/:establishmentId/:clientId/profile", protect, mod, getProfile);
router.put("/:establishmentId/:clientId/profile", protect, mod, updateProfile);

// atendimentos (mapa do pe + procedimentos + antes/depois)
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
router.get(
  "/:establishmentId/:clientId/sessions/:sessionId/pdf",
  protect,
  mod,
  sessionPdf
);

export default router;
