import { Router } from "express";
import {
  listTimeBlocks,
  createTimeBlock,
  deleteTimeBlock,
} from "../controllers/timeBlockController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/:establishmentId", protect, listTimeBlocks);
router.post("/:establishmentId", protect, createTimeBlock);
router.delete("/:establishmentId/:blockId", protect, deleteTimeBlock);

export default router;