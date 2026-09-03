import { Router } from "express";
import {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
} from "../controllers/serviceController";
import { getFreeSlots } from "../controllers/availabilityController";
import { protect, optionalProtect } from "../middleware/auth";

const router = Router();

router.get("/", listServices);
router.get("/:id", getService);
router.get("/:serviceId/slots", optionalProtect, getFreeSlots);
router.post("/", protect, createService);
router.put("/:id", protect, updateService);
router.delete("/:id", protect, deleteService);

export default router;
