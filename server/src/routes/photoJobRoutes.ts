import { Router } from "express";
import {
  listJobs,
  createJob,
  updateJob,
  jobPdf,
  deleteJob,
} from "../controllers/photoJobController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// briefing/contrato + galeria de entrega: extra da categoria fotografia
// (modulo "foto")
const mod = requireModule("foto");

router.get("/:establishmentId", protect, mod, listJobs);
router.post("/:establishmentId", protect, mod, createJob);
router.put("/:establishmentId/:id", protect, mod, updateJob);
router.get("/:establishmentId/:id/pdf", protect, mod, jobPdf);
router.delete("/:establishmentId/:id", protect, mod, deleteJob);

export default router;
