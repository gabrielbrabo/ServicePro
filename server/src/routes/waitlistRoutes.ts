import { Router } from "express";
import {
  joinWaitlist,
  listWaitlist,
  leaveWaitlist,
} from "../controllers/waitlistController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/", protect, joinWaitlist);
router.get("/", protect, listWaitlist);
router.delete("/:id", protect, leaveWaitlist);

export default router;