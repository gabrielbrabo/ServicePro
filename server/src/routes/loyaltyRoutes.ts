import { Router } from "express";
import {
  getProgram,
  setProgram,
  getCard,
  addStamp,
  removeStamp,
  redeem,
} from "../controllers/loyaltyController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// programa de fidelidade so existe na area Beleza (modulo "fidelidade")
const mod = requireModule("fidelidade");

// config do programa (por estabelecimento). Rotas "/program/..." vem antes
// das rotas por cliente para nao colidir com :clientId.
router.get("/program/:establishmentId", protect, mod, getProgram);
router.put("/program/:establishmentId", protect, mod, setProgram);

// cartao por cliente
router.get("/:establishmentId/:clientId", protect, mod, getCard);
router.post("/:establishmentId/:clientId/stamp", protect, mod, addStamp);
router.delete("/:establishmentId/:clientId/stamp", protect, mod, removeStamp);
router.post("/:establishmentId/:clientId/redeem", protect, mod, redeem);

export default router;
