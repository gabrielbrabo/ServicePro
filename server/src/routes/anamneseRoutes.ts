import { Router } from "express";
import {
  getForm,
  submit,
  listSubmissions,
  deleteSubmission,
} from "../controllers/anamneseController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

// rotas PUBLICAS (paciente preenche por link, sem login)
export const publicAnamneseRoutes = Router();
publicAnamneseRoutes.get("/:establishmentId", getForm);
publicAnamneseRoutes.post("/:establishmentId", submit);

// rotas PROTEGIDAS (dono ve as anamneses recebidas) — modulo "anamnese_link"
const mod = requireModule("anamnese_link");
const router = Router();
router.get("/:establishmentId", protect, mod, listSubmissions);
router.delete("/:establishmentId/:id", protect, mod, deleteSubmission);

export default router;
