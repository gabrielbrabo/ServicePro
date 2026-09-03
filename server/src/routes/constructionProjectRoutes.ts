import { Router } from "express";
import {
  listProjects,
  createProject,
  updateProject,
  addMeasurement,
  scheduleVisits,
  unscheduleVisits,
  deleteProject,
} from "../controllers/constructionProjectController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// obras (orcamento por etapas + medicoes + agenda): extra da categoria
// reformas-construcao (modulo "obra")
const mod = requireModule("obra");

router.get("/:establishmentId", protect, mod, listProjects);
router.post("/:establishmentId", protect, mod, createProject);
router.put("/:establishmentId/:id", protect, mod, updateProject);
// medicao (boletim) — fatura o avanco e lanca no caixa
router.post("/:establishmentId/:id/measurement", protect, mod, addMeasurement);
// agenda: gera / cancela as visitas de acompanhamento
router.post("/:establishmentId/:id/schedule", protect, mod, scheduleVisits);
router.post("/:establishmentId/:id/unschedule", protect, mod, unscheduleVisits);
router.delete("/:establishmentId/:id", protect, mod, deleteProject);

export default router;
