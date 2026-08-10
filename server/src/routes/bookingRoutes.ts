import { Router } from "express";
import {
  createBooking,
  listBookings,
  updateBookingStatus,
  rescheduleBooking,
  listEstablishmentClients,
  clientHistory,
  createRecurringBookings,
  cancelSeries,
  acceptReservation,
  declineReservation,
} from "../controllers/bookingController";
import { protect } from "../middleware/auth";

const router = Router();

// rotas especificas antes das com :id
router.get("/clients/:establishmentId", protect, listEstablishmentClients);
router.get("/history/:establishmentId/:clientId", protect, clientHistory);
router.post("/recurring", protect, createRecurringBookings);
router.delete("/series/:seriesId", protect, cancelSeries);

router.post("/", protect, createBooking);
router.get("/", protect, listBookings);
router.patch("/:id/status", protect, updateBookingStatus);
router.patch("/:id/reschedule", protect, rescheduleBooking);
router.patch("/:id/accept-reservation", protect, acceptReservation);
router.patch("/:id/decline-reservation", protect, declineReservation);

export default router;