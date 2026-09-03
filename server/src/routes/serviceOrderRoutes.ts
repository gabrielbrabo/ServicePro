import { Router } from "express";
import {
  listOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  orderPdf,
  ordersByPlate,
} from "../controllers/serviceOrderController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// Ordem de Servico: modulo base dos SERVICOS GERAIS (modulo "ordem_servico")
const mod = requireModule("ordem_servico");

router.get("/:establishmentId/history", protect, mod, ordersByPlate);
router.get("/:establishmentId", protect, mod, listOrders);
router.get("/:establishmentId/:id/pdf", protect, mod, orderPdf);
router.post("/:establishmentId", protect, mod, createOrder);
router.put("/:establishmentId/:id", protect, mod, updateOrder);
router.delete("/:establishmentId/:id", protect, mod, deleteOrder);

export default router;
