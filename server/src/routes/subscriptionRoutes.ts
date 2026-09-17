import { Router } from "express";
import {
  listPlans,
  getMySubscription,
  subscribe,
  cancelSubscription,
  reactivateSubscription,
  refreshStatus,
  getStatus,
  getSubscriptionPixCode,
  getSeats,
  buySeat,
  getGallery,
  buyGallery,
  paymentsWebhook,
} from "../controllers/subscriptionController";
import { protect } from "../middleware/auth";

const router = Router();

// catalogo de planos
router.get("/plans", protect, listPlans);

// status leve (dono ou membro) — usado pelo paywall do painel
router.get("/:establishmentId/status", protect, getStatus);

// assinatura por estabelecimento (somente o dono)
router.get("/:establishmentId", protect, getMySubscription);
router.get("/:establishmentId/pix", protect, getSubscriptionPixCode);
// assentos de funcionario (dono)
router.get("/:establishmentId/seats", protect, getSeats);
router.post("/:establishmentId/seats", protect, buySeat);
// espaco de galeria (dono)
router.get("/:establishmentId/gallery", protect, getGallery);
router.post("/:establishmentId/gallery", protect, buyGallery);
router.post("/:establishmentId", protect, subscribe);
router.post("/:establishmentId/cancel", protect, cancelSubscription);
router.post("/:establishmentId/reactivate", protect, reactivateSubscription);
router.post("/:establishmentId/refresh", protect, refreshStatus);

export default router;

// Webhook do gateway — montado SEPARADO (sem protect) em app.ts,
// em /api/webhooks/payments.
export { paymentsWebhook };
