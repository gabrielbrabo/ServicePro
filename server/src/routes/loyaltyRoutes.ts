import { Router } from "express";
import {
  getProgram,
  setProgram,
  listCards,
  getCard,
  addStamp,
  removeStamp,
  redeem,
} from "../controllers/loyaltyController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// programa de fidelidade (modulo "fidelidade", comum a todas as areas)
const mod = requireModule("fidelidade");

// config do programa (por estabelecimento). Rotas "/program/..." e "/.../cards"
// vem ANTES das rotas por :clientId para nao colidir com o parametro.
router.get("/program/:establishmentId", protect, mod, getProgram);
router.put("/program/:establishmentId", protect, mod, setProgram);

// lista de cartoes do estabelecimento (pendentes de recompensa primeiro)
router.get("/:establishmentId/cards", protect, mod, listCards);

// cartao por cliente
router.get("/:establishmentId/:clientId", protect, mod, getCard);
router.post("/:establishmentId/:clientId/stamp", protect, mod, addStamp);
router.delete("/:establishmentId/:clientId/stamp", protect, mod, removeStamp);
router.post("/:establishmentId/:clientId/redeem", protect, mod, redeem);

export default router;
