import { Request, Response } from "express";
import { PipelineStage, Types } from "mongoose";
import { Establishment } from "../models/Establishment";
import { User } from "../models/User";
import { Affiliate } from "../models/Affiliate";
import { Service } from "../models/Service";
import { Category } from "../models/Category";
import { AuthRequest } from "../middleware/auth";
import { geocodeAddress } from "../utils/geocode";
import { ensureOwnerProfessional } from "../utils/ownerProfessional";
import { buildSearchRegex } from "../utils/searchText";
import { isSegment, DEFAULT_SEGMENT } from "../config/segments";
import { isEstablishmentActive } from "../utils/subscriptionActive";
import { getPaymentProvider } from "../services/payments";
import { paymentsConfigured } from "../config/env";

// extrai o codigo de indicacao de um link (…/?ref=CODE) ou aceita o codigo cru
function extractRefCode(input: unknown): string {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s) return "";
  const m = s.match(/[?&]ref=([^&#\s]+)/i);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return s;
}

// vincula o dono a um afiliado/representante a partir do ref informado no
// cadastro do estabelecimento. So vincula se o dono ainda nao tem indicacao,
// o afiliado esta ativo e nao e auto-indicacao. Falha silenciosa.
async function linkAffiliateFromRef(
  userId: string | undefined,
  refRaw: unknown
): Promise<void> {
  try {
    const code = extractRefCode(refRaw);
    if (!code || !userId) return;
    const owner = await User.findById(userId).select("referredByAffiliate");
    if (!owner || owner.referredByAffiliate) return; // ja indicado: nao troca
    const aff = await Affiliate.findOne({
      code,
      status: "active",
    }).select("_id user");
    if (!aff || aff.user.toString() === userId) return; // invalido/auto-indicacao
    owner.referredByAffiliate = aff._id;
    await owner.save();
  } catch (e) {
    console.error("linkAffiliateFromRef:", (e as Error).message);
  }
}

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

    // area (segmento) escolhida no cadastro; padrao se ausente/invalida
    const segment = isSegment(req.body.segment)
      ? req.body.segment
      : DEFAULT_SEGMENT;
    // ciclo de cobranca: mensal (padrao) ou anual (2 meses gratis)
    const billingCycle = req.body.billingCycle === "anual" ? "anual" : "mensal";

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
      segment,
      billingCycle,
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

    // indicacao por afiliado/representante: se veio um link/codigo no cadastro e
    // o dono ainda nao tem afiliado vinculado, vincula agora (o split entra no
    // subscribe). Nao sobrescreve uma indicacao anterior nem permite auto-indicar.
    await linkAffiliateFromRef(req.userId, req.body.ref);

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

      // papel do usuario neste estabelecimento: dono, secretaria(o) ou profissional
      const myMember = est.members.find(
        (m) => m.professional?.toString() === req.userId
      );
      const myRole = isOwner
        ? "owner"
        : myMember?.role === "secretary"
          ? "secretary"
          : "professional";

      return {
        ...est.toObject(),
        myRole,
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

  // buscas textuais tolerantes (ignora acentos/espacos, escapa regex)
  const cityRx = buildSearchRegex(city);
  if (cityRx) filter["address.city"] = { $regex: cityRx, $options: "i" };
  const qRx = buildSearchRegex(q);
  if (qRx) filter.name = { $regex: qRx, $options: "i" };

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

    // buscas textuais tolerantes: trim, colapsa espacos, ignora acentos e
    // escapa/remove metacaracteres de regex (^ ~ * ( ) etc) da digitacao.
    const cityRx = buildSearchRegex(city);
    if (cityRx) filter["address.city"] = { $regex: cityRx, $options: "i" };

    const qRx = buildSearchRegex(q);
    if (qRx) filter.name = { $regex: qRx, $options: "i" };

    const serviceRx = buildSearchRegex(service);
    if (serviceRx) {
      const services = await Service.find({
        title: { $regex: serviceRx, $options: "i" },
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
          // nota ponderada pela quantidade de avaliacoes (shrinkage):
          //   score = (qtd / (qtd + M)) * media
          // Mais avaliacoes + media alta => topo. Poucas avaliacoes pesam
          // menos; sem avaliacao (qtd 0) fica com score 0 (vai pro fim).
          // M=5 e a "confianca minima" (quanto maior, mais avaliacoes
          // precisam para o score se aproximar da media real).
          ratingScore: {
            $let: {
              vars: {
                v: { $ifNull: ["$ratingCount", 0] },
                r: { $ifNull: ["$ratingAvg", 0] },
              },
              in: {
                $cond: [
                  { $gt: ["$$v", 0] },
                  {
                    $multiply: [
                      { $divide: ["$$v", { $add: ["$$v", 5] }] },
                      "$$r",
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      },
      // avaliacao manda na posicao: melhor/mais avaliado no topo.
      // priority (proximidade) e createdAt sao apenas criterios de desempate.
      { $sort: { ratingScore: -1, priority: 1, createdAt: -1 } },
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
  // recebe agendamentos? (assinatura ativa). Vira falso quando a assinatura
  // vence, para a pagina publica mostrar "indisponivel para agendamento".
  const bookingEnabled = await isEstablishmentActive(
    establishment._id.toString()
  );
  res.json({ ...establishment.toObject(), bookingEnabled });
};

// GET /api/establishments/:id/receivables  (dono)
// Situacao da subconta de recebimentos (Fluxo 2).
export const getReceivables = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const est = await Establishment.findById(req.params.id).select(
      "owner receivablesActive asaasWalletId"
    );
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (est.owner.toString() !== req.userId) {
      res.status(403).json({ message: "Apenas o dono acessa" });
      return;
    }

    const configured = !!est.receivablesActive && !!est.asaasWalletId;

    // conta de recebimento ja configurada em OUTRO estabelecimento do dono?
    // (mesma pessoa/CPF-CNPJ -> pode reaproveitar a mesma subconta Asaas)
    let reusableFrom: string | null = null;
    if (!configured) {
      const other = await Establishment.findOne({
        owner: est.owner,
        receivablesActive: true,
        asaasWalletId: { $ne: "" },
        _id: { $ne: est._id },
      }).select("name");
      reusableFrom = other?.name || null;
    }

    res.json({
      configured,
      paymentsEnabled: paymentsConfigured(),
      reusableFrom, // nome do outro estabelecimento (null = nada a reaproveitar)
    });
  } catch (err) {
    console.error("getReceivables:", err);
    res.status(500).json({ message: "Erro ao consultar recebimentos" });
  }
};

// POST /api/establishments/:id/receivables  (dono)
// Cria a subconta Asaas do estabelecimento para receber pagamentos do cliente.
// body: { cpfCnpj, incomeValue, postalCode, mobilePhone, email, birthDate?, companyType? }
export const setupReceivables = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const est = await Establishment.findById(req.params.id);
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (est.owner.toString() !== req.userId) {
      res.status(403).json({ message: "Apenas o dono pode configurar" });
      return;
    }
    if (est.receivablesActive && est.asaasWalletId) {
      res.json({ configured: true, walletId: est.asaasWalletId });
      return;
    }

    // reaproveitar a conta ja configurada em outro estabelecimento do dono
    // (mesma pessoa) — nao cria subconta nova no Asaas
    if ((req.body as { reuse?: boolean }).reuse) {
      const other = await Establishment.findOne({
        owner: est.owner,
        receivablesActive: true,
        asaasWalletId: { $ne: "" },
        _id: { $ne: est._id },
      }).select("asaasWalletId asaasAccountId asaasApiKey");
      if (!other) {
        res
          .status(400)
          .json({ message: "Nenhuma conta de recebimento para reaproveitar" });
        return;
      }
      est.asaasAccountId = other.asaasAccountId;
      est.asaasWalletId = other.asaasWalletId;
      est.asaasApiKey = other.asaasApiKey; // reaproveita a chave da subconta
      est.receivablesActive = true;
      await est.save();
      res.json({ configured: true, walletId: est.asaasWalletId, reused: true });
      return;
    }

    // dev / sem gateway: marca como configurado (carteira ficticia)
    if (!paymentsConfigured()) {
      est.asaasAccountId = "dev";
      est.asaasWalletId = "dev-wallet";
      est.receivablesActive = true;
      await est.save();
      res.json({ configured: true });
      return;
    }

    const provider = getPaymentProvider();
    if (!provider.createSubaccount) {
      res.status(400).json({ message: "Gateway nao suporta subconta" });
      return;
    }

    const { cpfCnpj, incomeValue, postalCode, mobilePhone, email, birthDate, companyType } =
      req.body as {
        cpfCnpj?: string;
        incomeValue?: number | string;
        postalCode?: string;
        mobilePhone?: string;
        email?: string;
        birthDate?: string;
        companyType?: string;
      };

    if (!cpfCnpj || !postalCode || !mobilePhone || !email || !incomeValue) {
      res
        .status(400)
        .json({ message: "Preencha CPF/CNPJ, e-mail, celular, CEP e faturamento." });
      return;
    }

    const cpfDigits = String(cpfCnpj).replace(/\D/g, "");

    // ja existe subconta com esse CPF/CNPJ no Asaas (dono ja tem conta)?
    // reaproveita — evita o erro "documento/e-mail ja em uso".
    if (provider.findSubaccount) {
      const existing = await provider.findSubaccount(cpfDigits);
      if (existing?.walletId) {
        est.asaasAccountId = existing.accountId;
        est.asaasWalletId = existing.walletId;
        est.receivablesActive = true;
        await est.save();
        res.json({ configured: true, walletId: est.asaasWalletId, reused: true });
        return;
      }
    }

    const acc = await provider.createSubaccount({
      name: est.name,
      email: String(email).trim(),
      cpfCnpj: cpfDigits,
      mobilePhone: String(mobilePhone).replace(/\D/g, ""),
      incomeValue: Number(incomeValue),
      address: est.address.street,
      addressNumber: est.address.number,
      province: est.address.neighborhood,
      postalCode: String(postalCode).replace(/\D/g, ""),
      birthDate: birthDate || undefined,
      companyType: companyType || undefined,
    });

    est.asaasAccountId = acc.accountId;
    est.asaasWalletId = acc.walletId;
    est.asaasApiKey = acc.apiKey; // chave da subconta (cobra direto nela)
    est.receivablesActive = !!acc.walletId;
    await est.save();

    res.json({ configured: est.receivablesActive, walletId: est.asaasWalletId });
  } catch (err: unknown) {
    const msg =
      (err as { message?: string })?.message || "Erro ao configurar recebimentos";
    console.error("setupReceivables:", err);
    res.status(400).json({ message: msg });
  }
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
      "active",
      "cashAutoEntry",
    ] as const;
    for (const field of editable) {
      if (field in req.body) {
        // @ts-expect-error atribuicao dinamica controlada pela lista editable
        establishment[field] = req.body[field];
      }
    }

    // categoria: so permite trocar para uma categoria da MESMA area (segmento).
    // Isso evita liberar/retirar modulos que nao pertencem ao segmento do
    // estabelecimento (o segment em si nao muda na edicao).
    if ("category" in req.body && req.body.category) {
      const newCatId = String(req.body.category);
      if (newCatId !== establishment.category.toString()) {
        if (!Types.ObjectId.isValid(newCatId)) {
          res.status(400).json({ message: "Categoria invalida" });
          return;
        }
        const cat = await Category.findById(newCatId).select("segment");
        if (!cat) {
          res.status(400).json({ message: "Categoria nao encontrada" });
          return;
        }
        // categoria sem area definida serve a qualquer segmento; com area
        // definida, precisa bater com a area do estabelecimento.
        if (cat.segment && cat.segment !== establishment.segment) {
          res.status(400).json({
            message:
              "So e possivel trocar para uma categoria da mesma area do estabelecimento",
          });
          return;
        }
        establishment.category = new Types.ObjectId(newCatId);
      }
    }

    // config de atendimento a domicilio (objeto aninhado, sanitizado)
    if (req.body.homeService !== undefined) {
      const h = req.body.homeService || {};
      establishment.homeService = {
        enabled: !!h.enabled,
        avgSpeedKmh: Math.max(1, Number(h.avgSpeedKmh) || 25),
        baseFee: Math.max(0, Number(h.baseFee) || 0),
        feePerKm: Math.max(0, Number(h.feePerKm) || 0),
        maxRadiusKm: Math.max(0, Number(h.maxRadiusKm) || 0),
      };
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