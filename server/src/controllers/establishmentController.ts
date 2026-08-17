import { Request, Response } from "express";
import { PipelineStage, Types } from "mongoose";
import { Establishment } from "../models/Establishment";
import { Service } from "../models/Service";
import { AuthRequest } from "../middleware/auth";
import { geocodeAddress } from "../utils/geocode";
import { ensureOwnerProfessional } from "../utils/ownerProfessional";

// POST /api/establishments  (protegido)
export const createEstablishment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, category, description, phone, photo, address, location } =
      req.body;

    if (!name || !category) {
      res.status(400).json({ message: "Nome e categoria sao obrigatorios" });
      return;
    }

    if (
      !address ||
      !address.country ||
      !address.state ||
      !address.city ||
      !address.neighborhood ||
      !address.street ||
      !address.number
    ) {
      res.status(400).json({ message: "Preencha todos os campos do endereco" });
      return;
    }

    const establishmentData: Record<string, unknown> = {
      owner: req.userId,
      category,
      name,
      description,
      phone,
      photo,
      address,
      members: [{ professional: req.userId, role: "owner", active: true }],
    };

    // coordenadas: o front (autocomplete do Google) ja envia as certas. Usa
    // elas quando validas; senao, cai no geocode do backend como fallback.
    const coordsFromClient =
      location &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length === 2 &&
      (location.coordinates[0] !== 0 || location.coordinates[1] !== 0)
        ? (location.coordinates as [number, number])
        : null;

    if (coordsFromClient) {
      establishmentData.location = {
        type: "Point",
        coordinates: coordsFromClient,
      };
    } else {
      const geo = await geocodeAddress(address);
      if (geo) {
        establishmentData.location = {
          type: "Point",
          coordinates: [geo.lon, geo.lat],
        };
      }
    }

    const establishment = await Establishment.create(establishmentData);

    // o dono tambem atende: cria seu profissional agendavel (vinculado a ele)
    const created = await ensureOwnerProfessional(establishment);
    if (created) await establishment.save();

    res.status(201).json(establishment);
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ message: "Nao foi possivel criar o estabelecimento" });
  }
};

// GET /api/establishments/mine  (protegido)
// Retorna estabelecimentos onde o user e dono OU membro-profissional.
// Anexa myRole ("owner"|"professional") e, se profissional, myProfessionalId
// (o _id do subdoc em professionals cujo linkedUser e este user) para o
// front filtrar a agenda e adaptar o painel.
export const myEstablishments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const list = await Establishment.find({
    $or: [{ owner: req.userId }, { "members.professional": req.userId }],
  })
    .populate("category", "name slug icon")
    .sort({ createdAt: -1 });

  const withRole = await Promise.all(
    list.map(async (est) => {
      const isOwner = est.owner.toString() === req.userId;

      // auto-heal: estabelecimentos criados antes desta feature nao tem o
      // profissional do dono. Cria na hora (so quando o proprio dono acessa).
      if (isOwner) {
        const created = await ensureOwnerProfessional(est);
        if (created) await est.save();
      }

      // myProfessionalId: o _id do subdoc cujo linkedUser e este user.
      // Vale para o dono (que agora tambem e profissional) e para o funcionario.
      const prof = est.professionals.find(
        (p) => p.linkedUser && p.linkedUser.toString() === req.userId
      );
      const myProfessionalId = prof ? prof._id.toString() : null;

      return {
        ...est.toObject(),
        myRole: isOwner ? "owner" : "professional",
        myProfessionalId,
      };
    })
  );

  res.json(withRole);
};

// GET /api/establishments  (publico) - busca simples
export const listEstablishments = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { category, city, q } = req.query;
  const filter: Record<string, unknown> = { active: true };
  if (category) filter.category = category;
  if (city) filter["address.city"] = { $regex: String(city), $options: "i" };
  if (q) filter.name = { $regex: String(q), $options: "i" };

  const list = await Establishment.find(filter)
    .populate("category", "name slug icon")
    .populate("owner", "name avatar")
    .sort({ createdAt: -1 });

  res.json(list);
};

// GET /api/establishments/search  (publico) - paginada (10 por pagina)
// Prioriza estabelecimentos da mesma cidade do usuario, depois do mesmo estado.
// Opcional: filtro por RAIO (lat, lng, radiusKm) usando o indice 2dsphere.
export const searchEstablishments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category, q, city, service, userCity, userState, lat, lng } =
      req.query;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { active: true };

    // category vem como string na URL; no aggregate precisa ser ObjectId
    if (category && Types.ObjectId.isValid(String(category))) {
      filter.category = new Types.ObjectId(String(category));
    }

    if (city) filter["address.city"] = { $regex: String(city), $options: "i" };
    if (q) filter.name = { $regex: String(q), $options: "i" };

    if (service) {
      const services = await Service.find({
        title: { $regex: String(service), $options: "i" },
        active: true,
      }).select("establishment");
      // converte para ObjectId para casar no $match do aggregate
      const ids = services.map((s) => new Types.ObjectId(s.establishment));
      filter._id = { $in: ids };
    }

    // ---- Filtro por raio (opcional) --------------------------------------
    // So aplica quando lat, lng e radiusKm sao numeros validos.
    // $centerSphere usa raio em RADIANOS = km / raio_da_Terra (6378.1 km).
    // Funciona dentro do $match do aggregate e no countDocuments, e usa o
    // indice 2dsphere ja existente. Estabelecimentos sem coordenadas reais
    // (default [0,0]) simplesmente ficam fora do raio do usuario.
    const latNum = lat !== undefined ? parseFloat(String(lat)) : NaN;
    const lngNum = lng !== undefined ? parseFloat(String(lng)) : NaN;
    const radiusNum =
      req.query.radiusKm !== undefined
        ? parseFloat(String(req.query.radiusKm))
        : NaN;

    const hasGeo =
      Number.isFinite(latNum) &&
      latNum >= -90 &&
      latNum <= 90 &&
      Number.isFinite(lngNum) &&
      lngNum >= -180 &&
      lngNum <= 180 &&
      Number.isFinite(radiusNum) &&
      radiusNum > 0;

    if (hasGeo) {
      const EARTH_RADIUS_KM = 6378.1;
      filter.location = {
        $geoWithin: {
          $centerSphere: [[lngNum, latNum], radiusNum / EARTH_RADIUS_KM],
        },
      };
    }
    // ----------------------------------------------------------------------

    const uCity = userCity ? String(userCity) : "";
    const uState = userState ? String(userState) : "";

    const pipeline: PipelineStage[] = [
      { $match: filter },
      {
        $addFields: {
          priority: {
            $cond: [
              { $and: [{ $ne: [uCity, ""] }, { $eq: ["$address.city", uCity] }] },
              0,
              {
                $cond: [
                  {
                    $and: [
                      { $ne: [uState, ""] },
                      { $eq: ["$address.state", uState] },
                    ],
                  },
                  1,
                  2,
                ],
              },
            ],
          },
        },
      },
      { $sort: { priority: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [rawItems, total] = await Promise.all([
      Establishment.aggregate(pipeline),
      Establishment.countDocuments(filter),
    ]);

    const items = await Establishment.populate(rawItems, [
      { path: "category", select: "name slug icon" },
      { path: "owner", select: "name avatar" },
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro na busca de estabelecimentos" });
  }
};

// GET /api/establishments/:id  (publico)
export const getEstablishment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const establishment = await Establishment.findById(req.params.id)
    .populate("category", "name slug icon")
    .populate("owner", "name avatar")
    .populate("members.professional", "name avatar");

  if (!establishment) {
    res.status(404).json({ message: "Estabelecimento nao encontrado" });
    return;
  }
  res.json(establishment);
};

// PUT /api/establishments/:id  (protegido, so o dono)
export const updateEstablishment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const establishment = await Establishment.findById(req.params.id);
    if (!establishment) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (establishment.owner.toString() !== req.userId) {
      res.status(403).json({ message: "Apenas o dono pode editar" });
      return;
    }

    const editable = [
      "name",
      "description",
      "phone",
      "photo",
      "category",
      "active",
      "cashAutoEntry",
    ] as const;
    for (const field of editable) {
      if (field in req.body) {
        // @ts-expect-error atribuicao dinamica controlada pela lista editable
        establishment[field] = req.body[field];
      }
    }

    if (req.body.address) {
      establishment.address = req.body.address;

      // prioriza as coordenadas enviadas pelo front (autocomplete do Google);
      // geocode do backend so como fallback.
      const loc = req.body.location;
      const coordsFromClient =
        loc &&
        Array.isArray(loc.coordinates) &&
        loc.coordinates.length === 2 &&
        (loc.coordinates[0] !== 0 || loc.coordinates[1] !== 0)
          ? (loc.coordinates as [number, number])
          : null;

      if (coordsFromClient) {
        establishment.location = {
          type: "Point",
          coordinates: coordsFromClient,
        };
      } else {
        const geo = await geocodeAddress(req.body.address);
        if (geo) {
          establishment.location = {
            type: "Point",
            coordinates: [geo.lon, geo.lat],
          };
        }
      }
    }

    await establishment.save();
    res.json(establishment);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Nao foi possivel atualizar" });
  }
};