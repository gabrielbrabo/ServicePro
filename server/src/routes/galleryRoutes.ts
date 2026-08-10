import { Router } from "express";
import {
  listGallery,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
} from "../controllers/galleryController";
import { protect } from "../middleware/auth";

const router = Router();

// listagem e publica (sem protect)
router.get("/:establishmentId", listGallery);

router.post("/:establishmentId", protect, createGalleryItem);
router.put("/:establishmentId/:itemId", protect, updateGalleryItem);
router.delete("/:establishmentId/:itemId", protect, deleteGalleryItem);

export default router;