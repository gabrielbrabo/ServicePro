import { Router } from "express";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/:establishmentId", protect, listProducts);
router.post("/:establishmentId", protect, createProduct);
router.put("/:establishmentId/:productId", protect, updateProduct);
router.delete("/:establishmentId/:productId", protect, deleteProduct);

export default router;