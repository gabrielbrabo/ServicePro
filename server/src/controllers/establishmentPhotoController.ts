import { Response } from "express";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";

const MAX_COVERS = 6;

// so o dono do estabelecimento gerencia as fotos
const loadOwnedEstablishment = async (
  establishmentId: string,
  userId?: string
) => {
  const est = await Establishment.findById(establishmentId);
  if (!est) return { est: null, forbidden: false };
  if (est.owner.toString() !== userId) return { est, forbidden: true };
  return { est, forbidden: false };
};

// aceita apenas URLs do nosso bucket, na pasta estabelecimentos
const isValidPhotoUrl = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url) return false;
  if (!/^https:\/\//i.test(url)) return false;
  return url.includes("/estabelecimentos/");
};

// GET /api/establishments/:establishmentId/photos  (PUBLICO)
export const getPhotos = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;

    const est = await Establishment.findById(establishmentId).select(
      "photo coverPhotos"
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    res.json({
      photo: est.photo || "",
      coverPhotos: est.coverPhotos || [],
    });
  } catch (err) {
    console.error("getPhotos:", err);
    res.status(500).json({ message: "Erro ao buscar as fotos" });
  }
};

// PUT /api/establishments/:establishmentId/photos/profile  (protegido, dono)
// body: { photo: string }  - envie "" para remover
export const updateProfilePhoto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { photo } = req.body;

    if (typeof photo !== "string") {
      res.status(400).json({ message: "Foto invalida" });
      return;
    }

    const clean = photo.trim();
    if (clean && !isValidPhotoUrl(clean)) {
      res.status(400).json({ message: "URL de foto invalida" });
      return;
    }

    const { est, forbidden } = await loadOwnedEstablishment(
      establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (forbidden) {
      res.status(403).json({ message: "Apenas o dono pode gerenciar" });
      return;
    }

    est.photo = clean;
    await est.save();

    res.json({
      message: clean ? "Foto de perfil atualizada" : "Foto de perfil removida",
      photo: est.photo || "",
      coverPhotos: est.coverPhotos || [],
    });
  } catch (err) {
    console.error("updateProfilePhoto:", err);
    res.status(500).json({ message: "Erro ao atualizar a foto de perfil" });
  }
};

// PUT /api/establishments/:establishmentId/photos/covers  (protegido, dono)
// body: { coverPhotos: string[] }
// Substitui a lista inteira. Serve para adicionar, remover e reordenar.
export const updateCoverPhotos = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { coverPhotos } = req.body;

    if (!Array.isArray(coverPhotos)) {
      res.status(400).json({ message: "coverPhotos deve ser uma lista" });
      return;
    }

    if (coverPhotos.length > MAX_COVERS) {
      res
        .status(400)
        .json({ message: `Maximo de ${MAX_COVERS} fotos de capa` });
      return;
    }

    const clean = coverPhotos
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter((p) => p !== "");

    if (clean.some((p) => !isValidPhotoUrl(p))) {
      res.status(400).json({ message: "Uma das URLs enviadas e invalida" });
      return;
    }

    // remove duplicatas mantendo a ordem
    const unique = Array.from(new Set(clean));

    const { est, forbidden } = await loadOwnedEstablishment(
      establishmentId,
      req.userId
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (forbidden) {
      res.status(403).json({ message: "Apenas o dono pode gerenciar" });
      return;
    }

    est.coverPhotos = unique;
    await est.save();

    res.json({
      message: "Fotos de capa atualizadas",
      photo: est.photo || "",
      coverPhotos: est.coverPhotos,
    });
  } catch (err) {
    console.error("updateCoverPhotos:", err);
    res.status(500).json({ message: "Erro ao atualizar as fotos de capa" });
  }
};