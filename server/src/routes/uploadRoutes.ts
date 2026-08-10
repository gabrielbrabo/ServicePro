import { Router } from "express";
import { presignUpload, deleteUpload } from "../controllers/uploadController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/presign", protect, presignUpload);
router.delete("/", protect, deleteUpload);

export default router;