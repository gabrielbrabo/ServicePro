import { Router } from "express";
import {
  getCurrentSession,
  openSession,
  addMovement,
  closeSession,
  listSessions,
  sellProduct,
  registerSale,
  voidMovement,
  receiveReceivable,
  listMovements,
  listReceivables,
  dashboard,
  movementReceipt,
} from "../controllers/cashController";
import { protect } from "../middleware/auth";

const router = Router();

// leitura
router.get("/:establishmentId/current", protect, getCurrentSession);
router.get("/:establishmentId/history", protect, listSessions);
router.get("/:establishmentId/dashboard", protect, dashboard);
router.get("/:establishmentId/movements", protect, listMovements);
router.get("/:establishmentId/receivables", protect, listReceivables);
router.get(
  "/:establishmentId/movement/:movementId/receipt",
  protect,
  movementReceipt
);

// operacao
router.post("/:establishmentId/open", protect, openSession);
router.post("/:establishmentId/movement", protect, addMovement);
router.post("/:establishmentId/sale", protect, registerSale);
router.post("/:establishmentId/sell", protect, sellProduct);
router.post("/:establishmentId/close", protect, closeSession);
router.post(
  "/:establishmentId/movement/:movementId/void",
  protect,
  voidMovement
);
router.post(
  "/:establishmentId/movement/:movementId/receive",
  protect,
  receiveReceivable
);

export default router;
