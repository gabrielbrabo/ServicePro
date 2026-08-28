import { Router } from "express";
import {
  listTerms,
  createTerm,
  signTerm,
  deleteTerm,
} from "../controllers/consentController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// termos de consentimento so existem na area Beleza (modulo "consentimento")
const mod = requireModule("consentimento");

router.get("/:establishmentId/:clientId", protect, mod, listTerms);
router.post("/:establishmentId/:clientId", protect, mod, createTerm);
router.patch("/:establishmentId/:clientId/:termId", protect, mod, signTerm);
router.delete("/:establishmentId/:clientId/:termId", protect, mod, deleteTerm);

export default router;
