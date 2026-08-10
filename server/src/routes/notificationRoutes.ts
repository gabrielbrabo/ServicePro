import { Router } from "express";
import {
  listNotifications,
  markAllRead,
  getBadges,
  markBookingsSeen,
} from "../controllers/notificationController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/", protect, listNotifications);
router.get("/badges", protect, getBadges);
router.patch("/read", protect, markAllRead);
router.patch("/bookings-seen", protect, markBookingsSeen);

export default router;