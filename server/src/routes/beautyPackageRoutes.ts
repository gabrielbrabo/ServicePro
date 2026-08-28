import { Router } from "express";
import {
  listPackages,
  createPackage,
  updatePackage,
  addPackageUse,
  removePackageUse,
  deletePackage,
} from "../controllers/beautyPackageController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// pacotes de sessoes na area Beleza (modulo "pacotes")
const mod = requireModule("pacotes");

router.get("/:establishmentId/:clientId", protect, mod, listPackages);
router.post("/:establishmentId/:clientId", protect, mod, createPackage);
router.patch(
  "/:establishmentId/:clientId/:packageId",
  protect,
  mod,
  updatePackage
);
router.delete(
  "/:establishmentId/:clientId/:packageId",
  protect,
  mod,
  deletePackage
);
router.post(
  "/:establishmentId/:clientId/:packageId/uses",
  protect,
  mod,
  addPackageUse
);
router.delete(
  "/:establishmentId/:clientId/:packageId/uses/:useId",
  protect,
  mod,
  removePackageUse
);

export default router;
