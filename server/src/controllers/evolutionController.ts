import { Response } from "express";
import { Types } from "mongoose";
import { Evolution } from "../models/Evolution";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { Service, effectiveDuration } from "../models/Service";
import { User } from "../models/User";
import { generateEvolutionsPdf } from "../utils/evolutionsPdf";
import { assertSlotIsBookable } from "../utils/slotValidation";
import { AuthRequest } from "../middleware/auth";

// Sincroniza o RETORNO com a agenda: se ha data + servico, cria (ou atualiza) um
// agendamento confirmado do paciente; se o retorno foi removido, cancela o
// agendamento futuro. Idempotente via returnBookingId.
async function syncReturnBooking(
  item: InstanceType<typeof Evolution>
): Promise<{ scheduled: boolean; reason?: string }> {
  const wants = !!item.nextReturn && !!item.returnService;
  if (wants) {
    const service = await Service.findById(item.returnService);
    if (!service || service.establishment.toString() !== item.establishment.toString())
      return { scheduled: false };
    const prof = item.returnProfessional || null;
    const start = new Date(item.nextReturn as Date);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + effectiveDuration(service, prof));

    // valida a disponibilidade (expediente, intervalos e bloqueios). Se o
    // horario nao estiver livre, NAO agenda; guarda o retorno so como lembrete e
    // cancela um agendamento anterior que porventura exista.
    const bookable = await assertSlotIsBookable(
      item.establishment,
      start,
      end,
      prof
    );
    if (!bookable.ok) {
      if (item.returnBookingId) {
        await Booking.updateOne(
          { _id: item.returnBookingId, scheduledAt: { $gte: new Date() } },
          { status: "cancelado" }
        );
        item.returnBookingId = null;
        await item.save();
      }
      return { scheduled: false, reason: bookable.reason };
    }

    const est = await Establishment.findById(item.establishment).select("owner");
    if (item.returnBookingId) {
      await Booking.updateOne(
        { _id: item.returnBookingId },
        {
          scheduledAt: start,
          endsAt: end,
          service: service._id,
          professional: prof,
          status: "confirmado",
        }
      );
    } else {
      const b = await Booking.create({
        client: item.client,
        establishment: item.establishment,
        owner: est?.owner,
        service: service._id,
        professional: prof,
        scheduledAt: start,
        endsAt: end,
        status: "confirmado",
        notes: "Retorno (evolução)",
        payment: {
          status: "pendente",
          amount: service.price,
          depositRequired: 0,
          depositPaid: false,
        },
      });
      item.returnBookingId = b._id as unknown as typeof item.returnBookingId;
      await item.save();
    }
    return { scheduled: true };
  } else if (item.returnBookingId) {
    await Booking.updateOne(
      { _id: item.returnBookingId, scheduledAt: { $gte: new Date() } },
      { status: "cancelado" }
    );
    item.returnBookingId = null;
    await item.save();
  }
  return { scheduled: false };
}

// anexa ao JSON de resposta um aviso quando havia retorno mas o horario estava
// indisponivel (o retorno fica so como lembrete, sem entrar na agenda).
function withReturnStatus(
  doc: InstanceType<typeof Evolution>,
  sync: { scheduled: boolean; reason?: string }
): Record<string, unknown> {
  const out = doc.toObject() as unknown as Record<string, unknown>;
  if (doc.nextReturn && doc.returnService && !sync.scheduled) {
    out.returnUnavailable = true;
    out.returnReason = sync.reason || "Horario indisponivel na agenda";
  }
  return out;
}

// dono OU membro do estabelecimento
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

// so registra evolucao para quem tem historico no estabelecimento
const clientHasBooking = async (
  establishmentId: string,
  clientId: string
): Promise<boolean> => {
  const b = await Booking.findOne({
    establishment: establishmentId,
    client: clientId,
  }).select("_id");
  return !!b;
};

const parseObjectId = (value: unknown): Types.ObjectId | undefined => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  if (!Types.ObjectId.isValid(value)) return undefined;
  return new Types.ObjectId(value);
};

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

// sanitiza a lista de CIDs: normaliza codigo (maiusculo), remove vazios e
// duplicados, limita a quantidade. Aceita entrada livre (qualquer codigo).
const cleanCids = (v: unknown): { code: string; description: string }[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: { code: string; description: string }[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const code = String(o.code ?? "").trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code: code.slice(0, 12),
      description: String(o.description ?? "").trim().slice(0, 200),
    });
    if (out.length >= 30) break;
  }
  return out;
};

// pelo menos um campo SOAP precisa ter conteudo
const hasSoapContent = (b: {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}): boolean =>
  !!(b.subjective || b.objective || b.assessment || b.plan);

// GET /api/evolutions/:establishmentId/:clientId  (protegido, dono/equipe)
export const listEvolutions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const items = await Evolution.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listEvolutions:", err);
    res.status(500).json({ message: "Erro ao listar evolucoes" });
  }
};

// POST /api/evolutions/:establishmentId/:clientId  (protegido, dono/equipe)
// body: { subjective?, objective?, assessment?, plan?, date?, bookingId? }
export const createEvolution = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este paciente nao tem atendimentos no estabelecimento" });
      return;
    }

    const soap = {
      subjective: cleanText(req.body.subjective),
      objective: cleanText(req.body.objective),
      assessment: cleanText(req.body.assessment),
      plan: cleanText(req.body.plan),
    };
    if (!hasSoapContent(soap)) {
      res.status(400).json({ message: "Preencha ao menos um campo da evolucao" });
      return;
    }

    // data: aceita o que veio; se invalida, usa agora
    const parsedDate = req.body.date ? new Date(req.body.date) : new Date();
    const date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    // vinculo com atendimento (opcional): valida que o booking e do paciente
    let booking = parseObjectId(req.body.bookingId);
    if (booking) {
      const b = await Booking.findOne({
        _id: booking,
        establishment: establishmentId,
        client: clientId,
      }).select("_id");
      if (!b) booking = undefined; // vinculo invalido: ignora em vez de travar
    }

    const nrRaw = req.body.nextReturn ? new Date(req.body.nextReturn) : null;
    const nextReturn = nrRaw && !isNaN(nrRaw.getTime()) ? nrRaw : undefined;
    const item = await Evolution.create({
      establishment: establishmentId,
      client: clientId,
      author: req.userId,
      booking,
      date,
      ...soap,
      cids: cleanCids(req.body.cids),
      nextReturn,
      returnService: parseObjectId(req.body.returnService),
      returnProfessional: parseObjectId(req.body.returnProfessional) || null,
    });
    const sync = await syncReturnBooking(item);

    const withAuthor = await item.populate("author", "name");
    res.status(201).json(withReturnStatus(withAuthor, sync));
  } catch (err) {
    console.error("createEvolution:", err);
    res.status(500).json({ message: "Erro ao criar evolucao" });
  }
};

// carrega a evolucao garantindo que pertence ao estabelecimento + paciente
async function loadEvolution(
  establishmentId: string,
  clientId: string,
  evolutionId: string
) {
  if (!Types.ObjectId.isValid(evolutionId)) return null;
  return Evolution.findOne({
    _id: evolutionId,
    establishment: establishmentId,
    client: clientId,
  });
}

// PUT /api/evolutions/:establishmentId/:clientId/:evolutionId  (dono/equipe)
export const updateEvolution = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, evolutionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const item = await loadEvolution(establishmentId, clientId, evolutionId);
    if (!item) {
      res.status(404).json({ message: "Evolucao nao encontrada" });
      return;
    }

    if (req.body.subjective !== undefined)
      item.subjective = cleanText(req.body.subjective);
    if (req.body.objective !== undefined)
      item.objective = cleanText(req.body.objective);
    if (req.body.assessment !== undefined)
      item.assessment = cleanText(req.body.assessment);
    if (req.body.plan !== undefined) item.plan = cleanText(req.body.plan);
    if (req.body.cids !== undefined) item.cids = cleanCids(req.body.cids);

    if (
      !hasSoapContent({
        subjective: item.subjective,
        objective: item.objective,
        assessment: item.assessment,
        plan: item.plan,
      })
    ) {
      res.status(400).json({ message: "Preencha ao menos um campo da evolucao" });
      return;
    }

    if (req.body.date !== undefined) {
      const d = new Date(req.body.date);
      if (!isNaN(d.getTime())) item.date = d;
    }
    if (req.body.nextReturn !== undefined) {
      if (!req.body.nextReturn) item.nextReturn = undefined;
      else {
        const d = new Date(req.body.nextReturn);
        if (!isNaN(d.getTime())) item.nextReturn = d;
      }
    }
    if (req.body.bookingId !== undefined) {
      const booking = parseObjectId(req.body.bookingId);
      if (!booking) {
        item.booking = undefined;
      } else {
        const b = await Booking.findOne({
          _id: booking,
          establishment: establishmentId,
          client: clientId,
        }).select("_id");
        item.booking = b ? booking : undefined;
      }
    }

    if (req.body.returnService !== undefined)
      item.returnService = parseObjectId(req.body.returnService);
    if (req.body.returnProfessional !== undefined)
      item.returnProfessional = parseObjectId(req.body.returnProfessional) || null;

    await item.save();
    const sync = await syncReturnBooking(item);
    const withAuthor = await item.populate("author", "name");
    res.json(withReturnStatus(withAuthor, sync));
  } catch (err) {
    console.error("updateEvolution:", err);
    res.status(500).json({ message: "Erro ao atualizar evolucao" });
  }
};

// GET /api/evolutions/:establishmentId/:clientId/pdf -> linha do tempo (PDF)
export const evolutionsPdf = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const [items, est, patient] = await Promise.all([
      Evolution.find({ establishment: establishmentId, client: clientId }).sort({
        date: -1,
        createdAt: -1,
      }),
      Establishment.findById(establishmentId).select("name phone"),
      User.findById(clientId).select("name"),
    ]);
    const pdf = await generateEvolutionsPdf({
      establishmentName: est?.name || "",
      phone: est?.phone,
      patientName: patient?.name,
      items: items.map((ev) => ({
        date: ev.date ? new Date(ev.date).toISOString() : "",
        subjective: ev.subjective,
        objective: ev.objective,
        assessment: ev.assessment,
        plan: ev.plan,
        cids: ev.cids.map((c) => ({ code: c.code, description: c.description })),
      })),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="evolucao.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("evolutionsPdf:", err);
    res.status(500).json({ message: "Erro ao gerar o PDF" });
  }
};

// DELETE /api/evolutions/:establishmentId/:clientId/:evolutionId  (dono/equipe)
export const deleteEvolution = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, evolutionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const item = await loadEvolution(establishmentId, clientId, evolutionId);
    if (!item) {
      res.status(404).json({ message: "Evolucao nao encontrada" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Evolucao removida", _id: evolutionId });
  } catch (err) {
    console.error("deleteEvolution:", err);
    res.status(500).json({ message: "Erro ao remover evolucao" });
  }
};
