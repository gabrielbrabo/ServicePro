import { Router } from "express";
import { protect } from "../middleware/auth";
import {
  listFavoriteIds,
  addFavorite,
  removeFavorite,
} from "../controllers/favoriteController";

const router = Router();

router.get("/ids", protect, listFavoriteIds);
router.post("/:establishmentId", protect, addFavorite);
router.delete("/:establishmentId", protect, removeFavorite);

export default router;
