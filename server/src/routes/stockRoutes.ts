import { Router } from "express";
import {
  listMovements,
  createMovement,
  listAllMovements,
} from "../controllers/stockController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/:establishmentId", protect, listAllMovements);
router.get("/:establishmentId/:productId", protect, listMovements);
router.post("/:establishmentId/:productId", protect, createMovement);

export default router;