import { Response } from "express";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import { deleteS3ByUrl } from "../config/s3";
import { ensureOwnerProfessional } from "../utils/ownerProfessional";

// so o dono do estabelecimento gerencia profissionais
const loadOwnedEstablishment = async (
  establishmentId: string,
  userId?: string
) => {
  const est = await Establishment.findById(establishmentId);
  if (!est) return { est: null, forbidden: false };
  if (est.owner.toString() !== userId) return { est, forbidden: true };
  return { est, forbidden: false };
};

// GET /api/establishments/:establishmentId/professionals  (publico)
// lista os profissionais ATIVOS (para o cliente escolher ao agendar).
// dono ve todos (inclui inativos) via query ?all=1 quando autenticado.
export const listProfessionals = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const est = await Establishment.findById(establishmentId);
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    // auto-heal: garante que o dono exista como profissional agendavel.
    // Estabelecimentos criados antes desta feature nao tinham. Roda para
    // qualquer visitante (o profissional do dono deve existir para todos),
    // mas so grava se realmente criou. Nunca derruba a listagem.
    try {
      const created = await ensureOwnerProfessional(est);
      if (created) await est.save();
    } catch (healErr) {
      console.error("ensureOwnerProfessional (listProfessionals):", healErr);
    }

    const isOwner = est.owner.toString() === req.userId;
    const wantsAll = req.query.all === "1" && isOwner;

    const list = wantsAll
      ? est.professionals
      : est.professionals.filter((p) => p.active);

    res.json(list);
  } catch (err) {
    console.error("listProfessionals:", err);
    res.status(500).json({ message: "Erro ao listar profissionais" });
  }
};

// POST /api/establishments/:establishmentId/professionals  (protegido, dono)
// body: { name, photo?, specialties? }
export const addProfessional = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { name, photo, specialties } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ message: "Nome do profissional e obrigatorio" });
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

    est.professionals.push({
      name: String(name).trim(),
      photo: photo || "",
      specialties: Array.isArray(specialties) ? specialties : [],
      active: true,
      linkedUser: null,
    } as never);

    await est.save();

    // devolve o recem-criado (ultimo do array)
    const created = est.professionals[est.professionals.length - 1];
    res.status(201).json(created);
  } catch (err) {
    console.error("addProfessional:", err);
    res.status(500).json({ message: "Erro ao adicionar profissional" });
  }
};

// PUT /api/establishments/:establishmentId/professionals/:professionalId
// (protegido, dono) - body: { name?, photo?, specialties?, active? }
export const updateProfessional = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, professionalId } = req.params;
    const { name, photo, specialties, active } = req.body;

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

    const prof = est.professionals.id(professionalId);
    if (!prof) {
      res.status(404).json({ message: "Profissional nao encontrado" });
      return;
    }

    // guarda a foto antiga: se for trocada ou removida, apaga do S3 no fim
    const oldPhoto = prof.photo || "";
    let photoReplaced = false;

    // Profissional COM login: nome e foto vem do proprio perfil (User) — o
    // perfil e a fonte da verdade. Aqui ignoramos mudancas de nome/foto para
    // esses; o dono edita so specialties/active. Para profissional SEM login,
    // o dono edita nome e foto normalmente.
    const hasLogin = !!prof.linkedUser;

    if (typeof name === "string" && name.trim() && !hasLogin) {
      prof.name = name.trim();
    }
    if (typeof photo === "string" && photo !== oldPhoto && !hasLogin) {
      prof.photo = photo;
      photoReplaced = true;
    }
    if (Array.isArray(specialties)) prof.specialties = specialties;
    if (typeof active === "boolean") prof.active = active;

    await est.save();

    // so apaga a imagem antiga depois que o Mongo confirmou a troca
    if (photoReplaced && oldPhoto) {
      await deleteS3ByUrl(oldPhoto);
    }

    res.json(prof);
  } catch (err) {
    console.error("updateProfessional:", err);
    res.status(500).json({ message: "Erro ao atualizar profissional" });
  }
};

// DELETE /api/establishments/:establishmentId/professionals/:professionalId
// (protegido, dono). Remocao SOFT: marca active=false, para nao orfanar
// bookings futuros que venham a referenciar o profissional.
// A foto NAO e apagada do S3 de proposito: o profissional pode ser reativado.
export const removeProfessional = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, professionalId } = req.params;

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

    const prof = est.professionals.id(professionalId);
    if (!prof) {
      res.status(404).json({ message: "Profissional nao encontrado" });
      return;
    }

    prof.active = false;
    await est.save();
    res.json({ message: "Profissional desativado", _id: professionalId });
  } catch (err) {
    console.error("removeProfessional:", err);
    res.status(500).json({ message: "Erro ao remover profissional" });
  }
};