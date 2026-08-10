import { Router } from "express";
import { getInvite, acceptInvite } from "../controllers/inviteController";

const router = Router();

// publicas: o funcionario ainda nao tem login ao abrir o convite
router.get("/:token", getInvite);
router.post("/:token/accept", acceptInvite);

export default router;