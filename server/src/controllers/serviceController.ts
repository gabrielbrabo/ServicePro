import { Request, Response } from "express";
import { Service } from "../models/Service";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import { Types } from "mongoose";

// Verifica se o usuario e dono OU membro do estabelecimento.
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

// Normaliza e valida a lista de profissionais de um servico:
// - aceita array de ids (strings)
// - mantem apenas ids validos que sejam profissionais DAQUELE estabelecimento
// Retorna { ok, ids, invalid } para o controller decidir.
const sanitizeProfessionals = async (
  establishmentId: string,
  raw: unknown
): Promise<{ ok: boolean; ids: Types.ObjectId[]; invalid: string[] }> => {
  if (raw === undefined) return { ok: true, ids: [], invalid: [] };
  if (!Array.isArray(raw)) return { ok: false, ids: [], invalid: [] };

  const est = await Establishment.findById(establishmentId).select(
    "professionals"
  );
  if (!est) return { ok: false, ids: [], invalid: [] };

  const validIds = new Set(
    est.professionals.map((p) => p._id.toString())
  );

  const ids: Types.ObjectId[] = [];
  const invalid: string[] = [];

  for (const item of raw) {
    const s = String(item);
    if (Types.ObjectId.isValid(s) && validIds.has(s)) {
      ids.push(new Types.ObjectId(s));
    } else {
      invalid.push(s);
    }
  }

  return { ok: invalid.length === 0, ids, invalid };
};

// GET /api/services  (busca publica, com filtros opcionais)
// ?establishment=ID  ?category=ID  ?q=texto
export const listServices = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { establishment, category, q } = req.query;
  const filter: Record<string, unknown> = { active: true };

  if (establishment) filter.establishment = establishment;
  if (category) filter.category = category;
  if (q) filter.$text = { $search: String(q) };

  const services = await Service.find(filter)
    .populate("establishment", "name city category")
    .populate("category", "name slug icon")
    .sort({ createdAt: -1 });

  res.json(services);
};

// GET /api/services/:id
export const getService = async (
  req: Request,
  res: Response
): Promise<void> => {
  const service = await Service.findById(req.params.id)
    .populate("establishment", "name city phone address category")
    .populate("category", "name slug icon");

  if (!service) {
    res.status(404).json({ message: "Servico nao encontrado" });
    return;
  }
  res.json(service);
};

// POST /api/services  (protegido) - cria servico no estabelecimento
// body: { establishment, category, title, description, price,
//         durationMinutes, photos?, professionals? }
export const createService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishment } = req.body;
    if (!establishment) {
      res.status(400).json({ message: "establishment e obrigatorio" });
      return;
    }
    if (!(await canManage(establishment, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    // valida/normaliza professionals contra a equipe do estabelecimento
    const sane = await sanitizeProfessionals(
      establishment,
      req.body.professionals
    );
    if (!sane.ok) {
      res.status(400).json({
        message: "Ha profissionais invalidos para este estabelecimento",
        invalid: sane.invalid,
      });
      return;
    }

    const payload = { ...req.body, professionals: sane.ids };
    const service = await Service.create(payload);
    res.status(201).json(service);
  } catch (err) {
    console.error("createService:", err);
    res.status(500).json({ message: "Erro ao criar servico" });
  }
};

// PUT /api/services/:id  (protegido, so quem gerencia o estabelecimento)
export const updateService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }
    if (!(await canManage(service.establishment.toString(), req.userId))) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    // nao deixa trocar o estabelecimento do servico
    delete req.body.establishment;

    // se professionals veio no body, valida contra a equipe deste estab.
    if (req.body.professionals !== undefined) {
      const sane = await sanitizeProfessionals(
        service.establishment.toString(),
        req.body.professionals
      );
      if (!sane.ok) {
        res.status(400).json({
          message: "Ha profissionais invalidos para este estabelecimento",
          invalid: sane.invalid,
        });
        return;
      }
      req.body.professionals = sane.ids;
    }

    Object.assign(service, req.body);
    await service.save();
    res.json(service);
  } catch (err) {
    console.error("updateService:", err);
    res.status(500).json({ message: "Erro ao atualizar servico" });
  }
};

// DELETE /api/services/:id  (protegido)
export const deleteService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    res.status(404).json({ message: "Servico nao encontrado" });
    return;
  }
  if (!(await canManage(service.establishment.toString(), req.userId))) {
    res.status(403).json({ message: "Sem permissao" });
    return;
  }
  await service.deleteOne();
  res.json({ message: "Servico removido" });
};