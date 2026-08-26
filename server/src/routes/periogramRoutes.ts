import { Router } from "express";
import {
  getPeriogram,
  setPerioTooth,
} from "../controllers/periogramController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";
import { audit } from "../middleware/auditMiddleware";

const router = Router();

// periograma e um recurso odontologico -> mesmo modulo "odontograma"
// (extra da categoria odontologia). Auditado como recurso "odontograma".
const mod = requireModule("odontograma");
const log = audit("odontograma");

router.get("/:establishmentId/:clientId", protect, mod, log, getPeriogram);
router.put(
  "/:establishmentId/:clientId/tooth",
  protect,
  mod,
  log,
  setPerioTooth
);

export default router;
