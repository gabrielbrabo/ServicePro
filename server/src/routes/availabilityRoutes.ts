import { Router } from "express";
import {
  setAvailability,
  getAvailability,
  getComboSlots,
} from "../controllers/availabilityController";
import { protect } from "../middleware/auth";

const router = Router();

// horarios livres para um combo de servicos. ANTES de "/:establishmentId"
// para nao ser capturado como se "combo-slots" fosse um id.
router.get("/combo-slots", getComboSlots);

// agenda semanal por estabelecimento
router.put("/:establishmentId", protect, setAvailability);
router.get("/:establishmentId", getAvailability);

export default router;
