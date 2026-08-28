import { Router } from "express";
import { getProfile, updateProfile } from "../controllers/browLashController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// extra da categoria sobrancelha-cilios (modulo "visagismo")
const mod = requireModule("visagismo");

router.get("/:establishmentId/:clientId", protect, mod, getProfile);
router.put("/:establishmentId/:clientId", protect, mod, updateProfile);

export default router;
