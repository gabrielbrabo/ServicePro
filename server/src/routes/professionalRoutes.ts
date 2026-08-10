import { Router } from "express";
import {
  listProfessionals,
  addProfessional,
  updateProfessional,
  removeProfessional,
} from "../controllers/professionalController";
import { protect } from "../middleware/auth";
import { createInvite } from "../controllers/inviteController";

// mergeParams: para enxergar :establishmentId do router pai
const router = Router({ mergeParams: true });

router.get("/", listProfessionals);
router.post("/", protect, addProfessional);
router.post("/:professionalId/invite", protect, createInvite);
router.put("/:professionalId", protect, updateProfessional);
router.delete("/:professionalId", protect, removeProfessional);

export default router;