import { Router } from "express";
import {
  adminListCoupons,
  adminCreateCoupons,
  adminUpdateCoupon,
  adminCouponRedemptions,
} from "../controllers/couponController";
import { protect } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";

// Ferramentas internas — so e-mails em ADMIN_EMAILS
const router = Router();
router.use(protect, requireAdmin);

router.get("/coupons", adminListCoupons);
router.post("/coupons", adminCreateCoupons);
router.patch("/coupons/:id", adminUpdateCoupon);
router.get("/coupons/:id/redemptions", adminCouponRedemptions);

export default router;
