import { Router } from "express";
import {
  createEstablishment,
  myEstablishments,
  listEstablishments,
  searchEstablishments,
  getEstablishment,
  updateEstablishment,
} from "../controllers/establishmentController";
import {
  getPhotos,
  updateProfilePhoto,
  updateCoverPhotos,
} from "../controllers/establishmentPhotoController";
import { protect } from "../middleware/auth";
import professionalRoutes from "./professionalRoutes";
import { listInvites } from "../controllers/inviteController";

const router = Router();

// sub-router aninhado (profissionais) — antes das rotas de :id
router.use("/:establishmentId/professionals", professionalRoutes);

// fotos do estabelecimento — antes das rotas com :id
router.get("/:establishmentId/photos", getPhotos);
router.put("/:establishmentId/photos/profile", protect, updateProfilePhoto);
router.put("/:establishmentId/photos/covers", protect, updateCoverPhotos);
router.get("/:establishmentId/invites", protect, listInvites);

// rotas especificas antes das com :id
router.get("/mine", protect, myEstablishments);
router.get("/search", searchEstablishments);
router.get("/", listEstablishments);
router.get("/:id", getEstablishment);
router.post("/", protect, createEstablishment);
router.put("/:id", protect, updateEstablishment);

export default router;