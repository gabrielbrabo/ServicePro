import { Router } from "express";
import { checkCoupon } from "../controllers/couponController";
import { protect } from "../middleware/auth";
import { createLimiter, clientIp } from "../utils/rateLimit";

const router = Router();

// freio contra "chutar" codigos de cupom (30 tentativas / 15 min por IP)
const checkLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  key: (req) => clientIp(req),
});

router.post("/check", protect, checkLimiter, checkCoupon);

export default router;
