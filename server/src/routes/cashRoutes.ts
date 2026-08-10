import { Router } from "express";
import {
  getCurrentSession,
  openSession,
  addMovement,
  closeSession,
  listSessions,
  sellProduct,
} from "../controllers/cashController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/:establishmentId/current", protect, getCurrentSession);
router.post("/:establishmentId/open", protect, openSession);
router.post("/:establishmentId/movement", protect, addMovement);
router.post("/:establishmentId/sell", protect, sellProduct);
router.post("/:establishmentId/close", protect, closeSession);
router.get("/:establishmentId/history", protect, listSessions);

export default router;