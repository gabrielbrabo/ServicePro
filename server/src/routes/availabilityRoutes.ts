import { Router } from "express";
import {
  setAvailability,
  getAvailability,
} from "../controllers/availabilityController";
import { protect } from "../middleware/auth";

const router = Router();

// agenda semanal por estabelecimento
router.put("/:establishmentId", protect, setAvailability);
router.get("/:establishmentId", getAvailability);

export default router;
