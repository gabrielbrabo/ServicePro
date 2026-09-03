import { Router } from "express";
import {
  getProfile,
  updateProfile,
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
} from "../controllers/nursingController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// modulo "enfermagem" (extra da categoria enfermagem). Todas as rotas tem
// :establishmentId (requireModule) e :clientId (paciente).
const mod = requireModule("enfermagem");

// ficha / perfil do paciente
router.get("/:establishmentId/:clientId/profile", protect, mod, getProfile);
router.put("/:establishmentId/:clientId/profile", protect, mod, updateProfile);

// registros (sinais vitais / curativos / medicacao) — ?kind= filtra
router.get("/:establishmentId/:clientId/records", protect, mod, listRecords);
router.post("/:establishmentId/:clientId/records", protect, mod, createRecord);
router.put(
  "/:establishmentId/:clientId/records/:recordId",
  protect,
  mod,
  updateRecord
);
router.delete(
  "/:establishmentId/:clientId/records/:recordId",
  protect,
  mod,
  deleteRecord
);

export default router;
