import { Router } from "express";
import {
  getRecord,
  updateRecord,
  addNote,
  deleteNote,
} from "../controllers/medicalRecordController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";
import { audit } from "../middleware/auditMiddleware";

const router = Router();

// prontuario so existe na area Saude (modulo "prontuario")
const mod = requireModule("prontuario");
const log = audit("prontuario");

router.get("/:establishmentId/:clientId", protect, mod, log, getRecord);
router.put("/:establishmentId/:clientId", protect, mod, log, updateRecord);
router.post("/:establishmentId/:clientId/notes", protect, mod, log, addNote);
router.delete(
  "/:establishmentId/:clientId/notes/:noteId",
  protect,
  mod,
  log,
  deleteNote
);

export default router;
