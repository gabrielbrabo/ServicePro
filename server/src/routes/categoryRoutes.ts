import { Router, Request, Response } from "express";
import { Category } from "../models/Category";
import { protect } from "../middleware/auth";

const router = Router();

// GET /api/categories
router.get("/", async (_req: Request, res: Response) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json(categories);
});

// POST /api/categories  (protegido)
router.post("/", protect, async (req: Request, res: Response) => {
  const category = await Category.create(req.body);
  res.status(201).json(category);
});

export default router;
