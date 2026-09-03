import { Router } from "express";
import {
  listRecords,
  createRecord,
  updateRecord,
  recordPdf,
  deleteRecord,
} from "../controllers/clinicalRecordController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// ficha clinica: extra saude (psicologia, fonoaudiologia, acupuntura,
// quiropraxia) — modulo "ficha_clinica"
const mod = requireModule("ficha_clinica");

router.get("/:establishmentId", protect, mod, listRecords);
router.post("/:establishmentId", protect, mod, createRecord);
router.put("/:establishmentId/:id", protect, mod, updateRecord);
router.get("/:establishmentId/:id/pdf", protect, mod, recordPdf);
router.delete("/:establishmentId/:id", protect, mod, deleteRecord);

export default router;
