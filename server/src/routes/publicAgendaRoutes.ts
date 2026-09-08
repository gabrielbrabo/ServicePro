import { Router } from "express";
import {
  getPublicAgenda,
  getPublicAgendaPhoto,
} from "../controllers/publicAgendaController";

// rotas PUBLICAS (sem login): agenda de divulgacao e a foto do perfil
export const publicAgendaRoutes = Router();
publicAgendaRoutes.get("/:establishmentId/photo", getPublicAgendaPhoto);
publicAgendaRoutes.get("/:establishmentId", getPublicAgenda);

export default publicAgendaRoutes;
