import { Router } from "express";
import {
  listBeforeAfter,
  addBeforeAfter,
  deleteBeforeAfter,
} from "../controllers/beautyBeforeAfterController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// antes & depois so existe na area Beleza (modulo "antes_depois")
const mod = requireModule("antes_depois");

router.get("/:establishmentId/:clientId", protect, mod, listBeforeAfter);
router.post("/:establishmentId/:clientId", protect, mod, addBeforeAfter);
router.delete(
  "/:establishmentId/:clientId/:itemId",
  protect,
  mod,
  deleteBeforeAfter
);

export default router;
