import { Router } from "express";
import {
  getBeautyRecord,
  updateBeautyRecord,
} from "../controllers/beautyRecordController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// ficha tecnica so existe na area Beleza (modulo "ficha")
const mod = requireModule("ficha");

router.get("/:establishmentId/:clientId", protect, mod, getBeautyRecord);
router.put("/:establishmentId/:clientId", protect, mod, updateBeautyRecord);

export default router;
