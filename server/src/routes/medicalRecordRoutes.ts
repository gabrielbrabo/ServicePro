import { Router } from "express";
import {
  getRecord,
  updateRecord,
  addNote,
  deleteNote,
} from "../controllers/medicalRecordController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/:establishmentId/:clientId", protect, getRecord);
router.put("/:establishmentId/:clientId", protect, updateRecord);
router.post("/:establishmentId/:clientId/notes", protect, addNote);
router.delete("/:establishmentId/:clientId/notes/:noteId", protect, deleteNote);

export default router;