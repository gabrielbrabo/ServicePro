import { Router } from "express";
import {
  listPieces,
  createPiece,
  updatePiece,
  addSession,
  removeSession,
  deletePiece,
  getHealth,
  updateHealth,
} from "../controllers/beautyTattooController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// extra da categoria tatuagem (modulo "tattoo")
const mod = requireModule("tattoo");

// declaracao de saude (por cliente) — antes das rotas por :pieceId
router.get("/:establishmentId/:clientId/health", protect, mod, getHealth);
router.put("/:establishmentId/:clientId/health", protect, mod, updateHealth);

router.get("/:establishmentId/:clientId", protect, mod, listPieces);
router.post("/:establishmentId/:clientId", protect, mod, createPiece);
router.patch("/:establishmentId/:clientId/:pieceId", protect, mod, updatePiece);
router.delete("/:establishmentId/:clientId/:pieceId", protect, mod, deletePiece);
router.post(
  "/:establishmentId/:clientId/:pieceId/sessions",
  protect,
  mod,
  addSession
);
router.delete(
  "/:establishmentId/:clientId/:pieceId/sessions/:sessionId",
  protect,
  mod,
  removeSession
);

export default router;
