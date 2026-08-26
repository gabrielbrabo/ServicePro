import { Router } from "express";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getTuss,
  setTuss,
  listCards,
  upsertCard,
  listClaims,
  getClaim,
  createClaim,
  updateClaim,
  deleteClaim,
  getTissConfig,
  setTissConfig,
  generateConsultaXml,
  generateSadtXml,
} from "../controllers/convenioController";
import { protect } from "../middleware/auth";
import { requireModule } from "../middleware/requireModule";

const router = Router();

// modulo "convenio" (area Saude). Permissoes finas ficam no controller
// (dono cadastra convenios/TUSS; staff lanca guias e carteirinhas).
const mod = requireModule("convenio");

// convenios (operadoras)
router.get("/:establishmentId/plans", protect, mod, listPlans);
router.post("/:establishmentId/plans", protect, mod, createPlan);
router.put("/:establishmentId/plans/:planId", protect, mod, updatePlan);
router.delete("/:establishmentId/plans/:planId", protect, mod, deletePlan);

// codigos TUSS por servico
router.get("/:establishmentId/tuss", protect, mod, getTuss);
router.put("/:establishmentId/tuss", protect, mod, setTuss);

// carteirinhas
router.get("/:establishmentId/cards", protect, mod, listCards);
router.put("/:establishmentId/cards", protect, mod, upsertCard);

// config TISS do prestador (Fase 2)
router.get("/:establishmentId/tiss-config", protect, mod, getTissConfig);
router.put("/:establishmentId/tiss-config", protect, mod, setTissConfig);

// guias
router.get("/:establishmentId/claims", protect, mod, listClaims);
router.post("/:establishmentId/claims", protect, mod, createClaim);
router.get("/:establishmentId/claims/:claimId", protect, mod, getClaim);
router.put("/:establishmentId/claims/:claimId", protect, mod, updateClaim);
router.delete("/:establishmentId/claims/:claimId", protect, mod, deleteClaim);

// gera o XML TISS (Guia de Consulta) — precisa vir depois das rotas acima
router.get(
  "/:establishmentId/claims/:claimId/tiss-xml",
  protect,
  mod,
  generateConsultaXml
);
router.get(
  "/:establishmentId/claims/:claimId/tiss-sadt-xml",
  protect,
  mod,
  generateSadtXml
);

export default router;
