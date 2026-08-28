import { Router } from "express";
import {
  listFormulas,
  addFormula,
  deleteFormula,
} from "../controllers/beautyFormulaController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// formulas so existem na area Beleza (modulo "formulas")
const mod = requireModule("formulas");

router.get("/:establishmentId/:clientId", protect, mod, listFormulas);
router.post("/:establishmentId/:clientId", protect, mod, addFormula);
router.delete(
  "/:establishmentId/:clientId/:formulaId",
  protect,
  mod,
  deleteFormula
);

export default router;
