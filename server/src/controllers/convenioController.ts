import { Response } from "express";
import { Types } from "mongoose";
import { HealthPlan } from "../models/HealthPlan";
import { InsuranceCard } from "../models/InsuranceCard";
import { InsuranceClaim } from "../models/InsuranceClaim";
import { TussSetting } from "../models/TussSetting";
import { TissProviderSetting } from "../models/TissProviderSetting";
import { Establishment } from "../models/Establishment";
import { Service } from "../models/Service";
import { AuthRequest } from "../middleware/auth";
import { buildConsultaXml } from "../utils/tissConsulta";
import { buildSadtXml } from "../utils/tissSadt";

// staff (dono ou funcionario) — cria/ve guias e carteirinhas
const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  }).select("_id");
  return !!est;
};

// dono — cadastra convenios e a tabela TUSS
const isOwner = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    owner: userId,
  }).select("_id");
  return !!est;
};

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

// ---------- Convenios (operadoras) ----------

export const listPlans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const plans = await HealthPlan.find({ establishment: establishmentId }).sort({
      name: 1,
    });
    res.json(plans);
  } catch (err) {
    console.error("listPlans:", err);
    res.status(500).json({ message: "Erro ao buscar convenios" });
  }
};

export const createPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await isOwner(establishmentId, req.userId))) {
      res.status(403).json({ message: "Apenas o dono cadastra convenios" });
      return;
    }
    const name = str(req.body.name);
    if (!name) {
      res.status(400).json({ message: "Nome do convenio e obrigatorio" });
      return;
    }
    const plan = await HealthPlan.create({
      establishment: establishmentId,
      name,
      ansRegistry: str(req.body.ansRegistry),
    });
    res.status(201).json(plan);
  } catch (err) {
    console.error("createPlan:", err);
    res.status(500).json({ message: "Erro ao criar convenio" });
  }
};

export const updatePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId, planId } = req.params;
    if (!(await isOwner(establishmentId, req.userId))) {
      res.status(403).json({ message: "Apenas o dono edita convenios" });
      return;
    }
    const plan = await HealthPlan.findOne({
      _id: planId,
      establishment: establishmentId,
    });
    if (!plan) {
      res.status(404).json({ message: "Convenio nao encontrado" });
      return;
    }
    if (typeof req.body.name === "string" && req.body.name.trim())
      plan.name = req.body.name.trim();
    if (typeof req.body.ansRegistry === "string")
      plan.ansRegistry = req.body.ansRegistry.trim();
    if (typeof req.body.active === "boolean") plan.active = req.body.active;
    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error("updatePlan:", err);
    res.status(500).json({ message: "Erro ao atualizar convenio" });
  }
};

export const deletePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId, planId } = req.params;
    if (!(await isOwner(establishmentId, req.userId))) {
      res.status(403).json({ message: "Apenas o dono remove convenios" });
      return;
    }
    await HealthPlan.findOneAndDelete({
      _id: planId,
      establishment: establishmentId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("deletePlan:", err);
    res.status(500).json({ message: "Erro ao remover convenio" });
  }
};

// ---------- Codigos TUSS por servico ----------

export const getTuss = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const [services, cfg] = await Promise.all([
      Service.find({ establishment: establishmentId, active: true })
        .select("title")
        .sort({ title: 1 }),
      TussSetting.findOne({ establishment: establishmentId }).select("codes"),
    ]);
    const map = new Map<string, { code: string; description?: string }>();
    (cfg?.codes || []).forEach((c) =>
      map.set(String(c.service), { code: c.code, description: c.description })
    );
    res.json({
      services: services.map((s) => {
        const cur = map.get(String(s._id));
        return {
          _id: String(s._id),
          title: (s as { title?: string }).title || "",
          code: cur?.code || "",
          description: cur?.description || "",
        };
      }),
    });
  } catch (err) {
    console.error("getTuss:", err);
    res.status(500).json({ message: "Erro ao buscar os codigos TUSS" });
  }
};

export const setTuss = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await isOwner(establishmentId, req.userId))) {
      res.status(403).json({ message: "Apenas o dono edita os codigos TUSS" });
      return;
    }
    const input = Array.isArray(req.body.codes) ? req.body.codes : [];
    const codes: { service: Types.ObjectId; code: string; description?: string }[] =
      [];
    for (const c of input) {
      if (!c || !Types.ObjectId.isValid(c.service)) continue;
      const code = str(c.code);
      if (!code) continue; // sem codigo = nao guarda
      codes.push({
        service: new Types.ObjectId(c.service),
        code,
        description: str(c.description),
      });
    }
    await TussSetting.findOneAndUpdate(
      { establishment: establishmentId },
      { codes, updatedBy: req.userId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("setTuss:", err);
    res.status(500).json({ message: "Erro ao salvar os codigos TUSS" });
  }
};

// ---------- Carteirinhas ----------

export const listCards = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const filter: Record<string, unknown> = { establishment: establishmentId };
    if (typeof req.query.client === "string" && req.query.client)
      filter.client = req.query.client;
    const cards = await InsuranceCard.find(filter).populate(
      "healthPlan",
      "name"
    );
    res.json(cards);
  } catch (err) {
    console.error("listCards:", err);
    res.status(500).json({ message: "Erro ao buscar carteirinhas" });
  }
};

export const upsertCard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const { client, healthPlan } = req.body;
    const number = str(req.body.number);
    if (
      !Types.ObjectId.isValid(client) ||
      !Types.ObjectId.isValid(healthPlan) ||
      !number
    ) {
      res.status(400).json({ message: "Dados da carteirinha invalidos" });
      return;
    }
    const card = await InsuranceCard.findOneAndUpdate(
      { establishment: establishmentId, client, healthPlan },
      {
        number,
        validThru: req.body.validThru ? new Date(req.body.validThru) : undefined,
        holderName: str(req.body.holderName),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(card);
  } catch (err) {
    console.error("upsertCard:", err);
    res.status(500).json({ message: "Erro ao salvar carteirinha" });
  }
};

// ---------- Guias ----------

const parseProcedures = (input: unknown): IClaimProcedureInput[] => {
  const arr = Array.isArray(input) ? input : [];
  const out: IClaimProcedureInput[] = [];
  for (const p of arr) {
    if (!p) continue;
    const tussCode = str((p as { tussCode?: unknown }).tussCode);
    if (!tussCode) continue;
    let quantity = Number((p as { quantity?: unknown }).quantity);
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    let unitValue = Number((p as { unitValue?: unknown }).unitValue);
    if (!Number.isFinite(unitValue) || unitValue < 0) unitValue = 0;
    const status = String((p as { status?: unknown }).status || "pendente");
    out.push({
      tussCode,
      description: str((p as { description?: unknown }).description),
      quantity,
      unitValue,
      status: ["pendente", "pago", "glosado"].includes(status)
        ? (status as "pendente" | "pago" | "glosado")
        : "pendente",
      glosaReason: str((p as { glosaReason?: unknown }).glosaReason),
    });
  }
  return out;
};

interface IClaimProcedureInput {
  tussCode: string;
  description?: string;
  quantity: number;
  unitValue: number;
  status: "pendente" | "pago" | "glosado";
  glosaReason?: string;
}

export const listClaims = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const filter: Record<string, unknown> = { establishment: establishmentId };
    if (typeof req.query.client === "string" && req.query.client)
      filter.client = req.query.client;
    if (typeof req.query.healthPlan === "string" && req.query.healthPlan)
      filter.healthPlan = req.query.healthPlan;
    const status = String(req.query.status || "");
    if (["pendente", "pago", "glosado"].includes(status))
      filter["procedures.status"] = status;
    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) {
        const d = new Date(String(req.query.from));
        d.setHours(0, 0, 0, 0);
        range.$gte = d;
      }
      if (req.query.to) {
        const d = new Date(String(req.query.to));
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
      filter.date = range;
    }

    const claims = await InsuranceClaim.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(300)
      .populate("healthPlan", "name")
      .populate("client", "name");

    res.json(claims);
  } catch (err) {
    console.error("listClaims:", err);
    res.status(500).json({ message: "Erro ao buscar guias" });
  }
};

export const getClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId, claimId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const claim = await InsuranceClaim.findOne({
      _id: claimId,
      establishment: establishmentId,
    })
      .populate("healthPlan", "name ansRegistry")
      .populate("client", "name");
    if (!claim) {
      res.status(404).json({ message: "Guia nao encontrada" });
      return;
    }
    res.json(claim);
  } catch (err) {
    console.error("getClaim:", err);
    res.status(500).json({ message: "Erro ao buscar a guia" });
  }
};

export const createClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const { client, healthPlan } = req.body;
    if (!Types.ObjectId.isValid(client) || !Types.ObjectId.isValid(healthPlan)) {
      res.status(400).json({ message: "Paciente e convenio sao obrigatorios" });
      return;
    }
    // convenio precisa ser do estabelecimento
    const plan = await HealthPlan.findOne({
      _id: healthPlan,
      establishment: establishmentId,
    }).select("_id");
    if (!plan) {
      res.status(400).json({ message: "Convenio invalido" });
      return;
    }

    const procedures = parseProcedures(req.body.procedures);
    if (procedures.length === 0) {
      res.status(400).json({ message: "Inclua ao menos um procedimento" });
      return;
    }

    const cardNumber = str(req.body.cardNumber);
    const cardValidThru = req.body.cardValidThru
      ? new Date(req.body.cardValidThru)
      : undefined;

    const claim = await InsuranceClaim.create({
      establishment: establishmentId,
      client,
      healthPlan,
      cardNumber,
      cardValidThru,
      professional: Types.ObjectId.isValid(req.body.professional)
        ? req.body.professional
        : undefined,
      booking: Types.ObjectId.isValid(req.body.booking)
        ? req.body.booking
        : undefined,
      guideNumber: str(req.body.guideNumber),
      date: req.body.date ? new Date(req.body.date) : new Date(),
      procedures,
      notes: str(req.body.notes),
      createdBy: req.userId,
    });

    // guarda/atualiza a carteirinha do paciente para reuso
    if (cardNumber) {
      await InsuranceCard.findOneAndUpdate(
        { establishment: establishmentId, client, healthPlan },
        { number: cardNumber, validThru: cardValidThru },
        { upsert: true, setDefaultsOnInsert: true }
      ).catch(() => undefined);
    }

    res.status(201).json(claim);
  } catch (err) {
    console.error("createClaim:", err);
    res.status(500).json({ message: "Erro ao criar a guia" });
  }
};

export const updateClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId, claimId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const claim = await InsuranceClaim.findOne({
      _id: claimId,
      establishment: establishmentId,
    });
    if (!claim) {
      res.status(404).json({ message: "Guia nao encontrada" });
      return;
    }

    if (Array.isArray(req.body.procedures)) {
      const procs = parseProcedures(req.body.procedures);
      if (procs.length === 0) {
        res.status(400).json({ message: "Inclua ao menos um procedimento" });
        return;
      }
      claim.procedures = procs as never;
    }
    if (typeof req.body.notes === "string") claim.notes = req.body.notes.trim();
    if (typeof req.body.guideNumber === "string")
      claim.guideNumber = req.body.guideNumber.trim();
    if (req.body.date) claim.date = new Date(req.body.date);
    if (Types.ObjectId.isValid(req.body.professional))
      claim.professional = req.body.professional;
    if (str(req.body.cardNumber)) claim.cardNumber = str(req.body.cardNumber);

    await claim.save();
    res.json(claim);
  } catch (err) {
    console.error("updateClaim:", err);
    res.status(500).json({ message: "Erro ao atualizar a guia" });
  }
};

export const deleteClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId, claimId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    await InsuranceClaim.findOneAndDelete({
      _id: claimId,
      establishment: establishmentId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteClaim:", err);
    res.status(500).json({ message: "Erro ao remover a guia" });
  }
};

// ---------- TISS: config do prestador (Fase 2) ----------

export const getTissConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const cfg = await TissProviderSetting.findOne({
      establishment: establishmentId,
    });
    res.json(cfg || { establishment: establishmentId, tissVersion: "4.03.00" });
  } catch (err) {
    console.error("getTissConfig:", err);
    res.status(500).json({ message: "Erro ao buscar a config TISS" });
  }
};

export const setTissConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await isOwner(establishmentId, req.userId))) {
      res.status(403).json({ message: "Apenas o dono edita a config TISS" });
      return;
    }
    const b = req.body || {};
    const cfg = await TissProviderSetting.findOneAndUpdate(
      { establishment: establishmentId },
      {
        cnpj: str(b.cnpj),
        cnes: str(b.cnes),
        providerCode: str(b.providerCode),
        contractedName: str(b.contractedName),
        tissVersion: str(b.tissVersion) || "4.03.00",
        profName: str(b.profName),
        councilCode: str(b.councilCode),
        councilNumber: str(b.councilNumber),
        councilUF: str(b.councilUF),
        cbo: str(b.cbo),
        updatedBy: req.userId,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(cfg);
  } catch (err) {
    console.error("setTissConfig:", err);
    res.status(500).json({ message: "Erro ao salvar a config TISS" });
  }
};

// GET /:establishmentId/claims/:claimId/tiss-xml
// gera o XML da Guia de Consulta a partir da guia + config + convenio.
export const generateConsultaXml = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, claimId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const [claim, cfg, est] = await Promise.all([
      InsuranceClaim.findOne({ _id: claimId, establishment: establishmentId })
        .populate("healthPlan", "name ansRegistry")
        .populate("client", "name"),
      TissProviderSetting.findOne({ establishment: establishmentId }),
      Establishment.findById(establishmentId).select("name"),
    ]);
    if (!claim) {
      res.status(404).json({ message: "Guia nao encontrada" });
      return;
    }

    const plan = claim.healthPlan as unknown as {
      name?: string;
      ansRegistry?: string;
    };
    const client = claim.client as unknown as { name?: string };

    const contractedName =
      cfg?.contractedName || (est as { name?: string })?.name || "";

    // avisos de campos faltantes (o validador tambem apontaria)
    const warnings: string[] = [];
    if (!plan?.ansRegistry) warnings.push("Registro ANS do convênio");
    if (!cfg?.cnpj) warnings.push("CNPJ do prestador");
    if (!cfg?.cnes) warnings.push("CNES");
    if (!cfg?.providerCode) warnings.push("Código do prestador na operadora");
    if (!cfg?.profName) warnings.push("Profissional executante");
    if (!cfg?.councilNumber) warnings.push("Número do conselho");
    if (!cfg?.cbo) warnings.push("CBO do profissional");
    if (!claim.cardNumber) warnings.push("Carteirinha do paciente");

    const now = new Date();
    const seq = String(now.getTime()).slice(-11);

    const { xml, hash } = buildConsultaXml({
      registroANS: plan?.ansRegistry || "",
      numeroGuiaPrestador: claim.guideNumber || String(claim._id).slice(-12),
      numeroCarteira: claim.cardNumber || "",
      nomeBeneficiario: client?.name || "",
      cnpj: cfg?.cnpj || "",
      cnes: cfg?.cnes || "",
      providerCode: cfg?.providerCode || "",
      contractedName,
      tissVersion: cfg?.tissVersion || "4.03.00",
      profName: cfg?.profName || "",
      councilCode: cfg?.councilCode || "",
      councilNumber: cfg?.councilNumber || "",
      councilUF: cfg?.councilUF || "",
      cbo: cfg?.cbo || "",
      dataAtendimento: claim.date,
      procedures: claim.procedures.map((p) => ({
        tussCode: p.tussCode,
        quantity: p.quantity || 1,
        unitValue: p.unitValue || 0,
      })),
      sequencial: seq,
      numeroLote: seq,
      generatedAt: now,
    });

    res.json({ xml, hash, warnings });
  } catch (err) {
    console.error("generateConsultaXml:", err);
    res.status(500).json({ message: "Erro ao gerar o XML TISS" });
  }
};

// GET /:establishmentId/claims/:claimId/tiss-sadt-xml
// gera o XML da Guia SP/SADT. Como a clinica costuma ser solicitante E
// executante, o solicitante e preenchido com os mesmos dados do executante.
export const generateSadtXml = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, claimId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const [claim, cfg, est] = await Promise.all([
      InsuranceClaim.findOne({ _id: claimId, establishment: establishmentId })
        .populate("healthPlan", "name ansRegistry")
        .populate("client", "name"),
      TissProviderSetting.findOne({ establishment: establishmentId }),
      Establishment.findById(establishmentId).select("name"),
    ]);
    if (!claim) {
      res.status(404).json({ message: "Guia nao encontrada" });
      return;
    }

    const plan = claim.healthPlan as unknown as {
      name?: string;
      ansRegistry?: string;
    };
    const client = claim.client as unknown as { name?: string };
    const contractedName =
      cfg?.contractedName || (est as { name?: string })?.name || "";

    const warnings: string[] = [];
    if (!plan?.ansRegistry) warnings.push("Registro ANS do convênio");
    if (!cfg?.cnpj) warnings.push("CNPJ do prestador");
    if (!cfg?.cnes) warnings.push("CNES");
    if (!cfg?.providerCode) warnings.push("Código do prestador na operadora");
    if (!cfg?.profName) warnings.push("Profissional (solicitante/executante)");
    if (!cfg?.councilNumber) warnings.push("Número do conselho");
    if (!cfg?.cbo) warnings.push("CBO do profissional");
    if (!claim.cardNumber) warnings.push("Carteirinha do paciente");

    const now = new Date();
    const seq = String(now.getTime()).slice(-11);

    const { xml, hash } = buildSadtXml({
      registroANS: plan?.ansRegistry || "",
      numeroGuiaPrestador: claim.guideNumber || String(claim._id).slice(-12),
      numeroCarteira: claim.cardNumber || "",
      nomeBeneficiario: client?.name || "",
      cnpj: cfg?.cnpj || "",
      tissVersion: cfg?.tissVersion || "4.03.00",
      // solicitante = executante (mesma clinica)
      solicCode: cfg?.providerCode || "",
      solicName: contractedName,
      solicProfName: cfg?.profName || "",
      solicConselho: cfg?.councilCode || "",
      solicNumero: cfg?.councilNumber || "",
      solicUF: cfg?.councilUF || "",
      solicCBO: cfg?.cbo || "",
      execCode: cfg?.providerCode || "",
      execCNES: cfg?.cnes || "",
      dataSolicitacao: claim.date,
      procedures: claim.procedures.map((p) => ({
        tussCode: p.tussCode,
        description: p.description,
        quantity: p.quantity || 1,
        unitValue: p.unitValue || 0,
      })),
      sequencial: seq,
      numeroLote: seq,
      generatedAt: now,
    });

    res.json({ xml, hash, warnings });
  } catch (err) {
    console.error("generateSadtXml:", err);
    res.status(500).json({ message: "Erro ao gerar o XML SP/SADT" });
  }
};
