import { Request, Response } from "express";
import { GalleryItem } from "../models/GalleryItem";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import { Types } from "mongoose";
import { deleteS3ByUrls } from "../config/s3";

// dono OU membro do estabelecimento gerencia a galeria
const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  });
  return !!est;
};

const parseObjectId = (value: unknown): Types.ObjectId | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

// anexa o nome do profissional (subdoc, populate normal nao funciona)
const attachProfessionalNames = async (
  establishmentId: Types.ObjectId | string,
  items: unknown[]
): Promise<unknown[]> => {
  const est = await Establishment.findById(establishmentId).select(
    "professionals"
  );
  const nameById = new Map<string, string>();
  est?.professionals.forEach((p) => nameById.set(p._id.toString(), p.name));

  return items.map((raw) => {
    const it = (raw as { toObject?: () => Record<string, unknown> }).toObject
      ? (raw as { toObject: () => Record<string, unknown> }).toObject()
      : (raw as Record<string, unknown>);
    const profId = it.professional ? String(it.professional) : null;
    return {
      ...it,
      professionalName: profId ? nameById.get(profId) ?? null : null,
    };
  });
};

// GET /api/gallery/:establishmentId  (PUBLICO)
// ?all=1 (autenticado, dono/equipe) inclui itens inativos
export const listGallery = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;

    const wantsAll =
      req.query.all === "1" &&
      (await canManage(establishmentId, req.userId));

    const filter: Record<string, unknown> = { establishment: establishmentId };
    if (!wantsAll) filter.active = true;

    const raw = await GalleryItem.find(filter)
      .populate("service", "title")
      .sort({ createdAt: -1 });

    const items = await attachProfessionalNames(establishmentId, raw);

    res.json(items);
  } catch (err) {
    console.error("listGallery:", err);
    res.status(500).json({ message: "Erro ao listar a galeria" });
  }
};

// POST /api/gallery/:establishmentId  (protegido, dono/equipe)
// body: { beforeUrl, afterUrl, title?, description?, professionalId?, serviceId? }
export const createGalleryItem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const {
      beforeUrl,
      afterUrl,
      title,
      description,
      professionalId,
      serviceId,
    } = req.body;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    if (!beforeUrl || !afterUrl) {
      res
        .status(400)
        .json({ message: "Envie as duas fotos (antes e depois)" });
      return;
    }

    const prof = parseObjectId(professionalId);

    // se veio profissional, valida que pertence ao estabelecimento
    if (prof) {
      const est = await Establishment.findOne({
        _id: establishmentId,
        "professionals._id": prof,
      }).select("_id");
      if (!est) {
        res
          .status(404)
          .json({ message: "Profissional nao encontrado no estabelecimento" });
        return;
      }
    }

    const item = await GalleryItem.create({
      establishment: establishmentId,
      beforeUrl,
      afterUrl,
      title: title || "",
      description: description || "",
      professional: prof,
      service: parseObjectId(serviceId),
      active: true,
      createdBy: req.userId,
    });

    const [withName] = await attachProfessionalNames(establishmentId, [item]);
    res.status(201).json(withName);
  } catch (err) {
    console.error("createGalleryItem:", err);
    res.status(500).json({ message: "Erro ao criar item da galeria" });
  }
};

// PUT /api/gallery/:establishmentId/:itemId  (protegido, dono/equipe)
export const updateGalleryItem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, itemId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const item = await GalleryItem.findOne({
      _id: itemId,
      establishment: establishmentId,
    });
    if (!item) {
      res.status(404).json({ message: "Item nao encontrado" });
      return;
    }

    const { title, description, professionalId, serviceId, active } = req.body;

    if (typeof title === "string") item.title = title;
    if (typeof description === "string") item.description = description;
    if (typeof active === "boolean") item.active = active;
    if (professionalId !== undefined) {
      item.professional = parseObjectId(professionalId);
    }
    if (serviceId !== undefined) {
      item.service = parseObjectId(serviceId);
    }

    await item.save();

    const [withName] = await attachProfessionalNames(establishmentId, [item]);
    res.json(withName);
  } catch (err) {
    console.error("updateGalleryItem:", err);
    res.status(500).json({ message: "Erro ao atualizar o item" });
  }
};

// DELETE /api/gallery/:establishmentId/:itemId  (protegido, dono/equipe)
// Remocao HARD: apaga o item e tambem as duas imagens no S3.
export const deleteGalleryItem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, itemId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const item = await GalleryItem.findOne({
      _id: itemId,
      establishment: establishmentId,
    });
    if (!item) {
      res.status(404).json({ message: "Item nao encontrado" });
      return;
    }

    // guarda as URLs antes de remover o documento
    const urls = [item.beforeUrl, item.afterUrl];

    await item.deleteOne();

    // limpeza do bucket: nunca derruba a resposta (falha silenciosa)
    await deleteS3ByUrls(urls);

    res.json({ message: "Item removido", _id: itemId });
  } catch (err) {
    console.error("deleteGalleryItem:", err);
    res.status(500).json({ message: "Erro ao remover o item" });
  }
};