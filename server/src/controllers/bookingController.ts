import { Response } from "express";
import { Booking } from "../models/Booking";
import { Service, effectiveDuration, depositFor } from "../models/Service";
import { Establishment } from "../models/Establishment";
import { CashSession } from "../models/CashSession";
import { AuthRequest } from "../middleware/auth";
import { getIO } from "../socket";
import { assertSlotIsBookable } from "../utils/slotValidation";
import { notifyWaitlistOpening } from "../utils/waitlistNotify";
import { professionalDoesService } from "../utils/serviceProfessional";
import {
  computeBusySegments,
  bookingSegments,
  segmentsOverlap,
} from "../utils/busySegments";
import { geocodeAddress } from "../utils/geocode";
import { estimateTravel, travelFee as calcTravelFee } from "../utils/travel";
import { postBookingToCash } from "../utils/cashPosting";
import { autoReserveSlot } from "../utils/autoReserve";
import { notifyManyAsync, establishmentRecipients } from "../utils/notify";
import {
  establishmentEmailRecipients,
  userEmail,
  formatWhen,
  notifyBookingCreatedAsync,
  notifyBookingConfirmedAsync,
  notifyBookingCancelledClientAsync,
  notifyBookingRescheduledClientAsync,
  notifyBookingRescheduledEstablishmentAsync,
  notifyReviewRequestClientAsync,
} from "../utils/bookingEmails";
import {
  notifyBookingConfirmedWhatsappAsync,
  notifyBookingCancelledWhatsappAsync,
  notifyBookingRescheduledWhatsappAsync,
  notifyReviewRequestWhatsappAsync,
} from "../utils/bookingWhatsapp";
import { applyLoyaltyOnCompletion } from "./loyaltyController";
import { env } from "../config/env";
import { signReviewToken } from "../utils/reviewToken";
import { Types } from "mongoose";

// busca o nome do profissional (subdoc) de um estabelecimento, se houver.
// Usado apenas para enriquecer os e-mails; falha silenciosa -> null.
const professionalNameOf = async (
  establishmentId: Types.ObjectId | string,
  professionalId?: Types.ObjectId | null
): Promise<string | null> => {
  if (!professionalId) return null;
  try {
    const est = await Establishment.findById(establishmentId).select(
      "professionals"
    );
    const prof = est?.professionals.id(professionalId);
    return prof?.name || null;
  } catch {
    return null;
  }
};

const parseProfessional = (value: unknown): Types.ObjectId | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

const VALID_METHODS = ["dinheiro", "cartao", "pix", "outro"];

// status que OCUPAM um horario (usado em todas as checagens de conflito)
const BUSY_STATUSES = ["pendente", "confirmado", "reservado"];

// Ha conflito de OCUPACAO com algum agendamento do dia? Compara segmento a
// segmento (a pausa de processamento de um nao bloqueia o outro). Busca os
// agendamentos do dia do profissional (ou do estabelecimento, se sem prof).
async function hasSegmentConflict(
  establishmentId: Types.ObjectId | string,
  prof: Types.ObjectId | null,
  around: Date,
  segments: { start: Date; end: Date }[],
  excludeId?: Types.ObjectId | string
): Promise<boolean> {
  const dayStart = new Date(
    around.getFullYear(),
    around.getMonth(),
    around.getDate()
  );
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const filter: Record<string, unknown> = {
    establishment: establishmentId,
    status: { $in: BUSY_STATUSES },
    scheduledAt: { $gte: dayStart, $lt: dayEnd },
  };
  if (prof) filter.professional = prof;
  if (excludeId) filter._id = { $ne: excludeId };
  const candidates = await Booking.find(filter).select(
    "scheduledAt endsAt bufferMinutes busySegments"
  );
  return candidates.some((b) => segmentsOverlap(segments, bookingSegments(b)));
}

// Servico TURMA: o mesmo horario (mesmo service + mesmo inicio) aceita ate
// `capacity` alunos. Bloqueia se (a) a turma lotou, ou (b) ha outro agendamento
// OCUPANDO o profissional/estab. que NAO seja desta mesma turma (o professor nao
// pode estar em duas coisas ao mesmo tempo). Alunos da mesma turma nao conflitam.
async function turmaSlotStatus(
  establishmentId: Types.ObjectId | string,
  serviceId: Types.ObjectId,
  capacity: number,
  prof: Types.ObjectId | null,
  start: Date,
  end: Date,
  excludeId?: Types.ObjectId | string
): Promise<{ ok: boolean; reason?: string }> {
  const cap = Math.max(1, capacity || 1);
  // (a) vagas: conta os desta mesma turma (mesmo service + mesmo inicio)
  const sameSlot: Record<string, unknown> = {
    establishment: establishmentId,
    service: serviceId,
    scheduledAt: start,
    status: { $in: BUSY_STATUSES },
  };
  if (excludeId) sameSlot._id = { $ne: excludeId };
  const taken = await Booking.countDocuments(sameSlot);
  if (taken >= cap) return { ok: false, reason: "Turma lotada neste horario" };

  // (b) outro agendamento ocupando o profissional/estab. (fora desta turma)
  const other: Record<string, unknown> = {
    establishment: establishmentId,
    status: { $in: BUSY_STATUSES },
    scheduledAt: { $lt: end },
    endsAt: { $gt: start },
    $nor: [{ service: serviceId, scheduledAt: start }],
  };
  if (prof) other.professional = prof;
  if (excludeId) other._id = { $ne: excludeId };
  const busy = await Booking.findOne(other).select("_id");
  if (busy) return { ok: false, reason: "Horario ja ocupado" };

  return { ok: true };
}

// POST /api/bookings  (protegido)
export const createBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { serviceId, serviceIds, scheduledAt, notes, address, professionalId } =
      req.body;

    // antecedencia do lembrete escolhida pelo cliente (min). Aceita apenas
    // valores previstos; qualquer outra coisa cai no padrao de 1 hora.
    const ALLOWED_REMINDERS = [15, 30, 45, 60, 120, 180];
    const rawReminder = Number(req.body.clientReminderMinutes);
    const clientReminderMinutes = ALLOWED_REMINDERS.includes(rawReminder)
      ? rawReminder
      : 60;

    // servicos do agendamento (combo). Aceita serviceIds[] (varios) ou
    // serviceId (unico). idList preserva a ordem escolhida.
    const rawIds: unknown[] =
      Array.isArray(serviceIds) && serviceIds.length
        ? serviceIds
        : serviceId
          ? [serviceId]
          : [];
    const idList = rawIds.filter(
      (x): x is string => typeof x === "string" && Types.ObjectId.isValid(x)
    );
    if (idList.length === 0) {
      res.status(400).json({ message: "Escolha ao menos um servico" });
      return;
    }

    const found = await Service.find({ _id: { $in: idList } });
    const orderedServices: typeof found = [];
    for (const id of idList) {
      const s = found.find((x) => String(x._id) === String(id));
      if (!s) {
        res.status(404).json({ message: "Servico nao encontrado" });
        return;
      }
      orderedServices.push(s);
    }
    // servico principal (1o do combo). Mantido em `service` para nao alterar o
    // restante do fluxo (notificacoes, e-mails etc.).
    const service = orderedServices[0];
    const isCombo = orderedServices.length > 1;

    // todos os servicos precisam ser do mesmo estabelecimento
    if (
      orderedServices.some(
        (s) => String(s.establishment) !== String(service.establishment)
      )
    ) {
      res
        .status(400)
        .json({ message: "Os servicos sao de estabelecimentos diferentes" });
      return;
    }

    const establishment = await Establishment.findById(service.establishment);
    if (!establishment) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    const prof = parseProfessional(professionalId);
    const activePros = establishment.professionals.filter((p) => p.active);

    if (activePros.length > 0 && !prof) {
      res
        .status(400)
        .json({ message: "Escolha um profissional para este agendamento" });
      return;
    }

    if (prof) {
      const exists = activePros.some((p) => p._id.toString() === prof.toString());
      if (!exists) {
        res
          .status(404)
          .json({ message: "Profissional nao encontrado ou inativo" });
        return;
      }
    }

    // o profissional precisa realizar TODOS os servicos do combo
    for (const s of orderedServices) {
      if (!professionalDoesService(s.professionals, prof)) {
        res.status(400).json({
          message: `Este profissional nao realiza o servico: ${s.title}`,
        });
        return;
      }
    }

    const totalDuration = orderedServices.reduce(
      (sum, s) => sum + effectiveDuration(s, prof),
      0
    );
    const totalPrice = orderedServices.reduce((sum, s) => sum + s.price, 0);
    // sinal exigido = soma do sinal de cada servico (2 casas)
    const depositRequired =
      Math.round(
        orderedServices.reduce((sum, s) => sum + depositFor(s), 0) * 100
      ) / 100;
    // folga do atendimento = maior buffer entre os servicos do combo
    const bufferMinutes = orderedServices.reduce(
      (max, s) => Math.max(max, s.bufferMinutes || 0),
      0
    );

    const start = new Date(scheduledAt);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "Data/hora invalida" });
      return;
    }
    const end = new Date(start);
    end.setUTCMinutes(end.getUTCMinutes() + totalDuration);

    // ---- atendimento a domicilio ----
    const wantsHome = req.body.atHome === true;
    // o modo de cada servico precisa ser compativel com a escolha
    for (const s of orderedServices) {
      const mode = s.serviceMode || "local";
      if (wantsHome && mode === "local") {
        res.status(400).json({
          message: `O servico "${s.title}" nao e atendido a domicilio`,
        });
        return;
      }
      if (!wantsHome && mode === "domicilio") {
        res.status(400).json({
          message: `O servico "${s.title}" e somente a domicilio`,
        });
        return;
      }
    }

    let atHome = false;
    let travelMinutes = 0;
    let travelKm = 0;
    let travelFeeValue = 0;
    let homeLat: number | null = null;
    let homeLng: number | null = null;
    let homeAddressStr: string | undefined = address;

    if (wantsHome) {
      // config de deslocamento do estabelecimento (com padroes se nao definida).
      // O que habilita o domicilio e o MODO do servico (ja validado acima).
      const hs = establishment.homeService || {
        enabled: true,
        avgSpeedKmh: 25,
        baseFee: 0,
        feePerKm: 0,
        maxRadiusKm: 0,
      };
      const addr = req.body.homeAddress;
      const complete =
        addr && addr.street && addr.number && addr.city && addr.state;
      if (!complete) {
        res.status(400).json({
          message: "Informe o endereco para o atendimento a domicilio",
        });
        return;
      }
      const estCoords = establishment.location?.coordinates;
      if (!estCoords || (estCoords[0] === 0 && estCoords[1] === 0)) {
        res.status(400).json({
          message:
            "O estabelecimento nao tem localizacao definida; nao da para calcular o deslocamento",
        });
        return;
      }
      // prefere as coordenadas enviadas pelo cliente (autocomplete); o geocode
      // do servidor (Nominatim) fica so como fallback.
      const cc = req.body.homeCoords;
      let geo: { lat: number; lon: number } | null =
        cc &&
        Number.isFinite(Number(cc.lat)) &&
        Number.isFinite(Number(cc.lng)) &&
        (Number(cc.lat) !== 0 || Number(cc.lng) !== 0)
          ? { lat: Number(cc.lat), lon: Number(cc.lng) }
          : null;
      if (!geo) {
        geo = await geocodeAddress({
          country: addr.country || "Brasil",
          state: addr.state,
          city: addr.city,
          neighborhood: addr.neighborhood || "",
          street: addr.street,
          number: addr.number,
        });
      }
      if (!geo) {
        res.status(400).json({
          message: "Nao foi possivel localizar o endereco informado",
        });
        return;
      }
      const estPoint = { lat: estCoords[1], lon: estCoords[0] };
      const t = estimateTravel(
        estPoint,
        { lat: geo.lat, lon: geo.lon },
        hs.avgSpeedKmh
      );
      const maxR = hs.maxRadiusKm || 0;
      if (maxR > 0 && t.km > maxR) {
        res.status(400).json({
          message: `Endereco fora da area de atendimento (${t.km.toFixed(
            1
          )} km; limite ${maxR} km)`,
        });
        return;
      }
      const baseFee = service.homeBaseFee ?? hs.baseFee;
      const feePerKm = service.homeFeePerKm ?? hs.feePerKm;
      travelFeeValue = calcTravelFee(t.km, baseFee, feePerKm);
      travelMinutes = t.oneWayMinutes;
      travelKm = t.km;
      homeLat = geo.lat;
      homeLng = geo.lon;
      atHome = true;
      homeAddressStr = [
        `${addr.street}, ${addr.number}`,
        addr.neighborhood,
        `${addr.city}/${addr.state}`,
      ]
        .filter(Boolean)
        .join(" - ");
    }

    // segmentos de ocupacao (pausa fica de fora; a domicilio inclui o
    // deslocamento de ida antes e de volta depois)
    const newSegments = computeBusySegments(
      orderedServices,
      start,
      prof,
      bufferMinutes,
      atHome ? travelMinutes : 0,
      atHome ? travelMinutes : 0
    );

    const bookable = await assertSlotIsBookable(
      service.establishment,
      start,
      end,
      prof
    );
    if (!bookable.ok) {
      res.status(409).json({ message: bookable.reason });
      return;
    }

    // conflito por SEGMENTOS: busca os agendamentos do dia (do profissional, se
    // houver) e compara segmento a segmento — assim a pausa de um nao bloqueia
    // o outro.
    // TURMA (aula em grupo): valida por vagas; senao, conflito por segmentos.
    if (!isCombo && service.classMode === "turma") {
      const st = await turmaSlotStatus(
        service.establishment,
        service._id,
        service.capacity,
        prof,
        start,
        end
      );
      if (!st.ok) {
        res.status(409).json({ message: st.reason });
        return;
      }
    } else if (
      await hasSegmentConflict(service.establishment, prof, start, newSegments)
    ) {
      res.status(409).json({ message: "Horario nao esta mais disponivel" });
      return;
    }

    // items so e preenchido no combo; servico unico fica com [] (legado)
    const items = isCombo
      ? orderedServices.map((s) => ({
          service: s._id,
          title: s.title,
          price: s.price,
          durationMinutes: s.durationMinutes,
        }))
      : [];

    // Agendamento feito pelo ESTABELECIMENTO para um cliente (ex.: controle de
    // retorno da enfermagem). So dono/equipe podem; o retorno ja entra
    // confirmado. Sem clientId, mantem o fluxo normal (cliente agenda pra si).
    let bookingClient: string = String(req.userId);
    let scheduledByEstablishment = false;
    if (req.body.clientId && Types.ObjectId.isValid(String(req.body.clientId))) {
      const uid = String(req.userId);
      const manages =
        establishment.owner.toString() === uid ||
        (establishment.members || []).some(
          (m) => m.professional && m.professional.toString() === uid
        );
      if (manages) {
        bookingClient = String(req.body.clientId);
        scheduledByEstablishment = true;
      }
    }

    const booking = await Booking.create({
      client: bookingClient,
      ...(scheduledByEstablishment ? { status: "confirmado" as const } : {}),
      establishment: service.establishment,
      owner: establishment.owner,
      service: service._id,
      items,
      bufferMinutes,
      busySegments: newSegments,
      professional: prof,
      scheduledAt: start,
      endsAt: end,
      notes,
      address: homeAddressStr,
      atHome,
      travelMinutes,
      travelKm,
      travelFee: travelFeeValue,
      homeLat,
      homeLng,
      clientReminderMinutes,
      payment: {
        status: "pendente",
        // aula mensal (nao-combo): cobra o valor do PLANO, nao o por sessao
        amount:
          (!isCombo && service.billing === "mensal"
            ? service.monthlyPrice || 0
            : totalPrice) + travelFeeValue,
        depositRequired:
          !isCombo && service.billing === "mensal" ? 0 : depositRequired,
        depositPaid: false,
      },
    });

    // rotulo do servico p/ notificacoes/e-mails ("Corte +2" no combo)
    const serviceLabel = isCombo
      ? `${service.title} +${orderedServices.length - 1}`
      : service.title;

    // notifica o lado do estabelecimento: dono e, se houver, o funcionario
    // vinculado ao profissional escolhido.
    const recipients = await establishmentRecipients(
      service.establishment,
      prof
    );

    // tempo real: emite para TODOS os envolvidos (dono + funcionario), senao
    // a lista do funcionario so atualiza ao recarregar a pagina
    const io = getIO();
    for (const userId of recipients) {
      io.to(`user:${userId}`).emit("booking:new", booking);
    }

    console.log("[createBooking] prof:", prof ? prof.toString() : "NULL");
    console.log("[createBooking] recipients:", recipients);

    const whenLabel = start.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    notifyManyAsync(recipients, {
      type: "booking_created",
      title: "Novo agendamento",
      body: `${serviceLabel} em ${whenLabel}`,
      booking: booking._id,
      establishment: service.establishment,
    });

    // ---- e-mails (Etapa B) ----
    // Apenas o lado do estabelecimento (dono + funcionario) recebe e-mail ao
    // criar. O cliente NAO recebe e-mail agora — so quando o estabelecimento
    // CONFIRMAR o agendamento. Fire-and-forget.
    const [estMails, profNameCreated] = await Promise.all([
      establishmentEmailRecipients(service.establishment, prof),
      professionalNameOf(service.establishment, prof),
    ]);
    notifyBookingCreatedAsync({
      establishmentEmails: estMails,
      ctx: {
        serviceTitle: serviceLabel,
        establishmentName: establishment.name,
        whenLabel,
        professionalName: profNameCreated,
      },
    });

    res.status(201).json(booking);
  } catch (err) {
    console.error("createBooking:", err);
    res.status(500).json({ message: "Erro ao criar agendamento" });
  }
};

// GET /api/bookings  (protegido)
export const listBookings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const role = req.query.role === "provider" ? "provider" : "client";
  const establishment = req.query.establishment as string | undefined;

  let filter: Record<string, unknown>;

  if (role === "client") {
    filter = { client: req.userId };
  } else {
    // role provider: pode ser o DONO ou um FUNCIONARIO (membro-profissional).
    // Dono ve todos os agendamentos do estabelecimento; funcionario ve apenas
    // aqueles em que ele e o profissional responsavel.
    filter = { owner: req.userId };

    if (establishment) {
      const est = await Establishment.findById(establishment).select(
        "owner professionals"
      );

      if (est && est.owner.toString() !== req.userId) {
        // nao e o dono: so pode ser funcionario. Descobre o professionalId dele
        // (o subdoc cujo linkedUser aponta para este user).
        const myProf = est.professionals.find(
          (p) => p.linkedUser && p.linkedUser.toString() === req.userId
        );

        if (!myProf) {
          // nem dono nem profissional vinculado: nao ve nada
          res.json([]);
          return;
        }

        // funcionario: filtra pelo estabelecimento e pelos agendamentos dele
        filter = { establishment, professional: myProf._id };
      } else {
        // e o dono: todos do estabelecimento
        filter = { owner: req.userId, establishment };
      }
    }
  }

  // reservas automaticas ainda nao aceitas nao aparecem para o estabelecimento:
  // so viram agendamento de verdade quando o cliente aceita (vira "pendente").
  if (role === "provider") {
    filter.status = { $ne: "reservado" };
  }

  const bookings = await Booking.find(filter)
    .populate("service", "title price durationMinutes description photos")
    .populate("client", "name avatar phone")
    .populate(
      "establishment",
      "name professionals photo address location phone"
    )
    .sort({ scheduledAt: 1 })
    .lean();

  // professional e subdoc de Establishment.professionals — nao ha populate.
  // Casa o id do profissional com o nome, dentro do establishment ja populado,
  // e anexa professionalName a cada booking.
  const withNames = bookings.map((b) => {
    const est = b.establishment as unknown as
      | {
          _id: Types.ObjectId;
          name: string;
          photo?: string;
          address?: unknown;
          location?: unknown;
          phone?: string;
          professionals?: Array<{ _id: Types.ObjectId; name: string }>;
        }
      | null
      | undefined;

    let professionalName: string | null = null;
    if (b.professional && est?.professionals) {
      const match = est.professionals.find(
        (p) => p._id.toString() === String(b.professional)
      );
      professionalName = match ? match.name : null;
    }

    // remove so a lista de profissionais (o front nao precisa dela aqui);
    // mantem foto, endereco, coordenadas e telefone para o card e o mapa.
    const establishmentTrimmed = est
      ? {
          _id: est._id,
          name: est.name,
          photo: est.photo,
          address: est.address,
          location: est.location,
          phone: est.phone,
        }
      : est;

    return {
      ...b,
      establishment: establishmentTrimmed,
      professionalName,
    };
  });

  res.json(withNames);
};

// PATCH /api/bookings/:id/status  (protegido)
// body: { status, paymentMethod? }
export const updateBookingStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, paymentMethod } = req.body;
    const allowed = ["confirmado", "concluido", "cancelado"];
    if (!allowed.includes(status)) {
      res.status(400).json({ message: "Status invalido" });
      return;
    }

    // antecedencia do lembrete do estabelecimento, escolhida por quem confirma.
    // So se aplica ao confirmar; valor invalido cai no padrao de 30 min.
    const ALLOWED_REMINDERS = [15, 30, 45, 60, 120, 180];
    const rawOwnerReminder = Number(req.body.ownerReminderMinutes);
    const ownerReminderChoice = ALLOWED_REMINDERS.includes(rawOwnerReminder)
      ? rawOwnerReminder
      : 30;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    const isOwner = booking.owner.toString() === req.userId;
    const isClient = booking.client.toString() === req.userId;

    // funcionario responsavel pelo agendamento tambem pode gerenciar (confirmar/
    // concluir/cancelar). Verifica se o user e o profissional do booking, via
    // linkedUser no subdoc do estabelecimento.
    let isAssignedProfessional = false;
    if (!isOwner && booking.professional) {
      const estProf = await Establishment.findById(
        booking.establishment
      ).select("professionals");
      const prof = estProf?.professionals.id(booking.professional);
      isAssignedProfessional =
        !!prof &&
        !!prof.linkedUser &&
        prof.linkedUser.toString() === req.userId;
    }

    if (
      !isOwner &&
      !isAssignedProfessional &&
      !(isClient && status === "cancelado")
    ) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    const wasActive = BUSY_STATUSES.includes(booking.status);

    if (status === "concluido") {
      if (!VALID_METHODS.includes(paymentMethod)) {
        res
          .status(400)
          .json({ message: "Informe a forma de pagamento para concluir" });
        return;
      }
      booking.payment.method = paymentMethod;
      booking.payment.status = "pago";
      booking.completedAt = new Date();

      // desconto / acrescimo aplicados no ato da conclusao. So na PRIMEIRA
      // conclusao (nao reaplica se o status ja era "concluido"), incidindo
      // sobre o valor atual (que ja inclui taxa de deslocamento, se houver).
      if (booking.status !== "concluido") {
        const disc = Math.max(0, Number(req.body.discount) || 0);
        const surch = Math.max(0, Number(req.body.surcharge) || 0);
        if (disc > 0 || surch > 0) {
          const base = booking.payment.amount || 0;
          booking.payment.discount = disc;
          booking.payment.surcharge = surch;
          booking.payment.amount =
            Math.round(Math.max(0, base - disc + surch) * 100) / 100;
        }
      }
    }

    booking.status = status;
    // ao sair do estado reservado, limpa o prazo
    if (status !== "reservado") {
      booking.reservationExpiresAt = undefined;
    }

    // ao confirmar, grava a antecedencia do lembrete do estabelecimento e
    // reseta o carimbo (para o cron reenviar se o horario/confirmacao mudou)
    if (status === "confirmado" && (isOwner || isAssignedProfessional)) {
      booking.ownerReminderMinutes = ownerReminderChoice;
      booking.ownerReminderSentAt = undefined;
    }

    // quem agiu define o sentido do aviso. Acao do estabelecimento (confirmar,
    // cancelar) marca o badge do cliente. "concluido" NAO gera badge: o cliente
    // esteve presente e ja sabe.
    const actedByEstablishment = isOwner || isAssignedProfessional;
    if (actedByEstablishment && status !== "concluido") {
      booking.clientNotifiedAt = new Date();
    }

    // fidelidade: ao concluir, carimba o cartao do cliente uma unica vez.
    const stampLoyalty =
      status === "concluido" &&
      actedByEstablishment &&
      !booking.loyaltyStamped;
    if (stampLoyalty) booking.loyaltyStamped = true;

    await booking.save();

    // efeito colateral fire-and-forget (nao bloqueia a resposta nem a derruba)
    if (stampLoyalty) {
      void applyLoyaltyOnCompletion(
        booking.establishment,
        booking.client,
        req.userId!
      );
    }

    if (status === "concluido") {
      const est = await Establishment.findById(booking.establishment).select(
        "cashAutoEntry"
      );
      const autoOn = est?.cashAutoEntry !== false;
      if (autoOn) {
        const openSession = await CashSession.findOne({
          establishment: booking.establishment,
          status: "aberto",
        });
        if (openSession) {
          await postBookingToCash(booking, openSession._id, req.userId!);
        }
      }
    }

    // tempo real: cliente + dono + funcionario do agendamento
    const estSide = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const io = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", booking);
    }

    // ---- notificacoes in-app ----
    const svc = await Service.findById(booking.service).select("title");
    const serviceTitle = svc?.title || "Agendamento";
    const when = booking.scheduledAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (actedByEstablishment) {
      // estabelecimento agiu -> avisa o CLIENTE
      if (status === "concluido") {
        // conclusao vira convite para avaliar. Uma avaliacao por ATENDIMENTO:
        // cada visita concluida pede sua propria avaliacao (booking.reviewed
        // marca ESTE agendamento como ja avaliado).
        if (!booking.reviewed) {
          // nome do estabelecimento para a mensagem ("Avalie o Salao X")
          const estForReview = await Establishment.findById(
            booking.establishment
          ).select("name");
          const estName = estForReview?.name || "o estabelecimento";
          notifyManyAsync([booking.client], {
            type: "review_request",
            title: `Avalie ${estName}`,
            body: `Como foi seu ${serviceTitle} em ${estName}? Toque para dar sua nota em estrelas.`,
            booking: booking._id,
            establishment: booking.establishment,
          });

          // convite tambem por e-mail e WhatsApp, com link que abre a
          // avaliacao em 1 toque (token assinado, sem exigir login)
          const reviewUrl = `${env.clientUrl}/avaliar/${signReviewToken(
            String(booking._id)
          )}`;
          notifyReviewRequestClientAsync({
            clientEmail: await userEmail(booking.client),
            establishmentName: estName,
            serviceTitle,
            reviewUrl,
          });
          notifyReviewRequestWhatsappAsync({
            clientId: booking.client,
            establishmentName: estName,
            serviceTitle,
            reviewUrl,
          });
        }
      } else {
        const titles: Record<string, string> = {
          confirmado: "Agendamento confirmado",
          cancelado: "Agendamento cancelado",
        };
        notifyManyAsync([booking.client], {
          type:
            status === "confirmado"
              ? "booking_confirmed"
              : "booking_cancelled",
          title: titles[status] || "Agendamento atualizado",
          body: `${serviceTitle} em ${when}`,
          booking: booking._id,
          establishment: booking.establishment,
        });
      }
    } else if (isClient && status === "cancelado") {
      // cliente cancelou -> avisa o estabelecimento (dono + funcionario)
      const recipients = await establishmentRecipients(
        booking.establishment,
        booking.professional
      );
      notifyManyAsync(recipients, {
        type: "booking_cancelled",
        title: "Agendamento cancelado pelo cliente",
        body: `${serviceTitle} em ${when}`,
        booking: booking._id,
        establishment: booking.establishment,
      });
    }

    // ---- e-mails (Etapa B) ----
    // Regras: estabelecimento confirma -> cliente; estabelecimento cancela ->
    // cliente. Concluir NAO gera e-mail (cliente esteve presente). Cliente
    // cancela NAO gera e-mail (so notificacao in-app).
    if (actedByEstablishment && (status === "confirmado" || status === "cancelado")) {
      const [clientMailU, estForNameU, profNameU] = await Promise.all([
        userEmail(booking.client),
        Establishment.findById(booking.establishment).select("name"),
        professionalNameOf(booking.establishment, booking.professional),
      ]);
      const ctxU = {
        serviceTitle,
        establishmentName: estForNameU?.name || "",
        whenLabel: when,
        professionalName: profNameU,
      };
      if (status === "confirmado") {
        notifyBookingConfirmedAsync({ clientEmail: clientMailU, ctx: ctxU });
        notifyBookingConfirmedWhatsappAsync({
          clientId: booking.client,
          ctx: ctxU,
        });
      } else {
        notifyBookingCancelledClientAsync({
          clientEmail: clientMailU,
          ctx: ctxU,
        });
        notifyBookingCancelledWhatsappAsync({
          clientId: booking.client,
          ctx: ctxU,
        });
      }
    }

    // cancelamento libera a vaga: tenta reservar para o proximo da fila;
    // se nao houver quem reservar, notifica a fila normalmente.
    if (status === "cancelado" && wasActive) {
      const reserved = await autoReserveSlot(
        booking.establishment,
        booking.service,
        booking.professional,
        booking.scheduledAt,
        booking.endsAt
      );
      if (!reserved) {
        await notifyWaitlistOpening(
          booking.establishment,
          booking.service,
          booking.scheduledAt,
          booking.professional
        );
      }
    }

    res.json(booking);
  } catch (err) {
    console.error("updateBookingStatus:", err);
    res.status(500).json({ message: "Erro ao atualizar agendamento" });
  }
};

// PATCH /api/bookings/:id/reschedule  (protegido)
export const rescheduleBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { scheduledAt, professionalId } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    const isOwner = booking.owner.toString() === req.userId;
    const isClient = booking.client.toString() === req.userId;

    // funcionario responsavel pelo agendamento tambem pode reagendar (mesmo
    // padrao do updateBookingStatus): e o profissional do booking cujo
    // linkedUser aponta para este user.
    let isAssignedProfessional = false;
    if (!isOwner && booking.professional) {
      const estProf = await Establishment.findById(
        booking.establishment
      ).select("professionals");
      const profDoc = estProf?.professionals.id(booking.professional);
      isAssignedProfessional =
        !!profDoc &&
        !!profDoc.linkedUser &&
        profDoc.linkedUser.toString() === req.userId;
    }

    if (!isOwner && !isClient && !isAssignedProfessional) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    // funcionario reagendando conta como o ESTABELECIMENTO agindo (avisa o
    // cliente), nao como o cliente.
    const actedByEstablishment = isOwner || isAssignedProfessional;

    if (booking.status === "concluido" || booking.status === "cancelado") {
      res.status(400).json({
        message: "Nao e possivel reagendar um agendamento concluido ou cancelado",
      });
      return;
    }

    const start = new Date(scheduledAt);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "Data/hora invalida" });
      return;
    }

    const service = await Service.findById(booking.service);
    if (!service) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }
    // preserva a duracao total do agendamento (vale para combo tambem)
    const durationMs =
      booking.endsAt.getTime() - booking.scheduledAt.getTime();
    const end = new Date(start.getTime() + durationMs);

    let prof: Types.ObjectId | null = booking.professional
      ? new Types.ObjectId(booking.professional.toString())
      : null;
    if (professionalId !== undefined) {
      prof = parseProfessional(professionalId);
    }

    const establishment = await Establishment.findById(booking.establishment);
    if (establishment) {
      const activePros = establishment.professionals.filter((p) => p.active);
      if (activePros.length > 0 && !prof) {
        res
          .status(400)
          .json({ message: "Escolha um profissional para reagendar" });
        return;
      }
      if (prof) {
        const exists = activePros.some(
          (p) => p._id.toString() === prof!.toString()
        );
        if (!exists) {
          res
            .status(404)
            .json({ message: "Profissional nao encontrado ou inativo" });
          return;
        }
      }
    }

    if (!professionalDoesService(service.professionals, prof)) {
      res
        .status(400)
        .json({ message: "Este profissional nao realiza o servico" });
      return;
    }

    // combo: o profissional precisa realizar todos os servicos do agendamento
    for (const it of booking.items) {
      const svc = await Service.findById(it.service).select(
        "professionals title"
      );
      if (svc && !professionalDoesService(svc.professionals, prof)) {
        res.status(400).json({
          message: `Este profissional nao realiza o servico: ${it.title}`,
        });
        return;
      }
    }

    const bookable = await assertSlotIsBookable(
      booking.establishment,
      start,
      end,
      prof
    );
    if (!bookable.ok) {
      res.status(409).json({ message: bookable.reason });
      return;
    }

    // desloca os segmentos de ocupacao para o novo horario (mesma duracao e
    // mesma estrutura de pausa) e checa conflito por segmentos.
    const delta = start.getTime() - booking.scheduledAt.getTime();
    const shifted = bookingSegments(booking).map((s) => ({
      start: new Date(s.start.getTime() + delta),
      end: new Date(s.end.getTime() + delta),
    }));
    if (
      await hasSegmentConflict(
        booking.establishment,
        prof,
        start,
        shifted,
        booking._id
      )
    ) {
      res.status(409).json({ message: "Horario nao esta disponivel" });
      return;
    }

    booking.rescheduleHistory.push({
      previousScheduledAt: booking.scheduledAt,
      previousEndsAt: booking.endsAt,
      rescheduledBy: req.userId as unknown as (typeof booking.client),
      rescheduledByRole: isOwner
        ? "dono"
        : isAssignedProfessional
          ? "profissional"
          : "cliente",
      at: new Date(),
    });

    booking.scheduledAt = start;
    booking.endsAt = end;
    booking.set("busySegments", shifted);
    booking.professional = prof;
    booking.status = "pendente";
    booking.reservationExpiresAt = undefined;
    // horario mudou: rearma os lembretes ja enviados para o novo horario.
    // (o do estabelecimento sera regravado na proxima confirmacao)
    booking.clientReminderSentAt = undefined;
    booking.ownerReminderSentAt = undefined;

    // reagendamento feito pelo estabelecimento (dono OU funcionario) marca o
    // badge do cliente
    if (actedByEstablishment) {
      booking.clientNotifiedAt = new Date();
    }

    await booking.save();

    // tempo real: cliente + dono + funcionario
    const estSideR = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const ioR = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSideR])) {
      ioR.to(`user:${uid}`).emit("booking:rescheduled", booking);
    }
    // ---- notificacoes in-app ----
    const whenNew = start.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (actedByEstablishment) {
      // estabelecimento (dono ou funcionario) reagendou -> avisa o cliente
      notifyManyAsync([booking.client], {
        type: "booking_rescheduled",
        title: "Agendamento remarcado",
        body: `${service.title} agora em ${whenNew}`,
        booking: booking._id,
        establishment: booking.establishment,
      });
    } else {
      // cliente reagendou -> avisa o estabelecimento
      const recipients = await establishmentRecipients(
        booking.establishment,
        prof
      );
      notifyManyAsync(recipients, {
        type: "booking_rescheduled",
        title: "Agendamento remarcado pelo cliente",
        body: `${service.title} agora em ${whenNew}`,
        booking: booking._id,
        establishment: booking.establishment,
      });
    }

    // ---- e-mails (Etapa B) ----
    // estabelecimento reagenda -> cliente; cliente reagenda -> dono + funcionario.
    const estForNameR = establishment || (await Establishment.findById(
      booking.establishment
    ).select("name"));
    const profNameR = await professionalNameOf(booking.establishment, prof);
    const ctxR = {
      serviceTitle: service.title,
      establishmentName: estForNameR?.name || "",
      whenLabel: whenNew,
      professionalName: profNameR,
    };
    if (actedByEstablishment) {
      const clientMailR = await userEmail(booking.client);
      notifyBookingRescheduledClientAsync({
        clientEmail: clientMailR,
        ctx: ctxR,
      });
      notifyBookingRescheduledWhatsappAsync({
        clientId: booking.client,
        ctx: ctxR,
      });
    } else {
      const estMailsR = await establishmentEmailRecipients(
        booking.establishment,
        prof
      );
      notifyBookingRescheduledEstablishmentAsync({
        establishmentEmails: estMailsR,
        ctx: ctxR,
      });
    }

    res.json(booking);
  } catch (err) {
    console.error("Erro ao reagendar:", err);
    res.status(500).json({ message: "Erro ao reagendar agendamento" });
  }
};

// GET /api/bookings/clients/:establishmentId  (protegido, dono/equipe)
export const listEstablishmentClients = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;

    const est = await Establishment.findOne({
      _id: establishmentId,
      $or: [{ owner: req.userId }, { "members.professional": req.userId }],
    }).select("_id");
    if (!est) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const rows = await Booking.aggregate([
      { $match: { establishment: new Types.ObjectId(String(establishmentId)) } },
      {
        $group: {
          _id: "$client",
          bookingCount: { $sum: 1 },
          lastBooking: { $max: "$scheduledAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: "$client" },
      {
        $project: {
          _id: "$client._id",
          name: "$client.name",
          avatar: "$client.avatar",
          bookingCount: 1,
          lastBooking: 1,
        },
      },
      { $sort: { lastBooking: -1 } },
    ]);

    res.json(rows);
  } catch (err) {
    console.error("listEstablishmentClients:", err);
    res.status(500).json({ message: "Erro ao listar clientes" });
  }
};

// GET /api/bookings/history/:establishmentId/:clientId  (protegido, dono/equipe)
export const clientHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;

    const est = await Establishment.findOne({
      _id: establishmentId,
      $or: [{ owner: req.userId }, { "members.professional": req.userId }],
    }).select("professionals");
    if (!est) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const nameById = new Map<string, string>();
    est.professionals.forEach((p) => nameById.set(p._id.toString(), p.name));

    const bookings = await Booking.find({
      establishment: establishmentId,
      client: clientId,
      status: "concluido",
    })
      .populate("service", "title")
      .sort({ scheduledAt: -1 });

    const history = bookings.map((b) => ({
      _id: b._id,
      scheduledAt: b.scheduledAt,
      completedAt: b.completedAt ?? null,
      serviceTitle:
        (b.service as unknown as { title?: string })?.title ?? "Serviço",
      professionalName: b.professional
        ? nameById.get(b.professional.toString()) ?? null
        : null,
      amount: b.payment?.amount ?? 0,
      method: b.payment?.method ?? "",
    }));

    res.json(history);
  } catch (err) {
    console.error("clientHistory:", err);
    res.status(500).json({ message: "Erro ao buscar historico do cliente" });
  }
};

// POST /api/bookings/recurring  (protegido)
export const createRecurringBookings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      serviceId,
      scheduledAt,
      professionalId,
      notes,
      address,
      frequency,
      repetitions,
    } = req.body;

    // antecedencia do lembrete escolhida pelo cliente, aplicada a serie toda
    const ALLOWED_REMINDERS = [15, 30, 45, 60, 120, 180];
    const rawReminder = Number(req.body.clientReminderMinutes);
    const clientReminderMinutes = ALLOWED_REMINDERS.includes(rawReminder)
      ? rawReminder
      : 60;

    if (!["semanal", "quinzenal"].includes(frequency)) {
      res.status(400).json({ message: "Frequencia invalida" });
      return;
    }
    const reps = Number(repetitions);
    if (!Number.isInteger(reps) || reps < 2 || reps > 52) {
      res
        .status(400)
        .json({ message: "Numero de repeticoes invalido (2 a 52)" });
      return;
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }

    const establishment = await Establishment.findById(service.establishment);
    if (!establishment) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }

    const prof = parseProfessional(professionalId);
    const activePros = establishment.professionals.filter((p) => p.active);

    if (activePros.length > 0 && !prof) {
      res
        .status(400)
        .json({ message: "Escolha um profissional para este agendamento" });
      return;
    }
    if (prof) {
      const exists = activePros.some((p) => p._id.toString() === prof.toString());
      if (!exists) {
        res
          .status(404)
          .json({ message: "Profissional nao encontrado ou inativo" });
        return;
      }
    }
    if (!professionalDoesService(service.professionals, prof)) {
      res
        .status(400)
        .json({ message: "Este profissional nao realiza o servico escolhido" });
      return;
    }

    const firstStart = new Date(scheduledAt);
    if (isNaN(firstStart.getTime())) {
      res.status(400).json({ message: "Data/hora invalida" });
      return;
    }

    const stepDays = frequency === "semanal" ? 7 : 14;
    const seriesId = new Types.ObjectId();

    const created: unknown[] = [];
    const skipped: { date: string; reason: string }[] = [];

    for (let i = 0; i < reps; i++) {
      const start = new Date(firstStart);
      start.setDate(start.getDate() + i * stepDays);

      const end = new Date(start);
      end.setUTCMinutes(end.getUTCMinutes() + service.durationMinutes);

      const bookable = await assertSlotIsBookable(
        service.establishment,
        start,
        end,
        prof
      );
      if (!bookable.ok) {
        skipped.push({
          date: start.toISOString(),
          reason: bookable.reason || "Indisponivel",
        });
        continue;
      }

      if (service.classMode === "turma") {
        const st = await turmaSlotStatus(
          service.establishment,
          service._id,
          service.capacity,
          prof,
          start,
          end
        );
        if (!st.ok) {
          skipped.push({
            date: start.toISOString(),
            reason: st.reason || "Indisponivel",
          });
          continue;
        }
      } else {
        const conflictFilter: Record<string, unknown> = {
          establishment: service.establishment,
          status: { $in: BUSY_STATUSES },
          scheduledAt: { $lt: end },
          endsAt: { $gt: start },
        };
        if (prof) conflictFilter.professional = prof;
        const conflito = await Booking.findOne(conflictFilter);
        if (conflito) {
          skipped.push({
            date: start.toISOString(),
            reason: "Horario ja ocupado",
          });
          continue;
        }
      }

      const booking = await Booking.create({
        client: req.userId,
        establishment: service.establishment,
        owner: establishment.owner,
        service: service._id,
        professional: prof,
        seriesId,
        scheduledAt: start,
        endsAt: end,
        notes,
        address,
        clientReminderMinutes,
        payment: {
          status: "pendente",
          // mensal: cobra o plano so na 1a aula (i===0); demais R$0
          amount:
            service.billing === "mensal"
              ? i === 0
                ? service.monthlyPrice
                : 0
              : service.price,
          depositRequired:
            service.billing === "mensal" ? 0 : depositFor(service),
          depositPaid: false,
        },
      });

      created.push(booking);
    }

    if (created.length === 0) {
      res.status(409).json({
        message: "Nenhum horario da serie esta disponivel",
        created: [],
        skipped,
      });
      return;
    }

    // avisa todos os envolvidos do lado do estabelecimento (dono + funcionario
    // vinculado), nao so o dono. Um emit basta: o BookingList recarrega a lista.
    const recipients = await establishmentRecipients(
      service.establishment,
      prof
    );
    const io = getIO();
    for (const uid of recipients) {
      io.to(`user:${uid}`).emit("booking:new", created[0]);
    }

    res.status(201).json({
      seriesId: seriesId.toString(),
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  } catch (err) {
    console.error("createRecurringBookings:", err);
    res.status(500).json({ message: "Erro ao criar agendamentos recorrentes" });
  }
};

// POST /api/bookings/enrollment  (protegido) — o ESTABELECIMENTO matricula um
// ALUNO numa serie recorrente. body:
//   { establishmentId, serviceId, clientId, professionalId?, slots: ISO[],
//     weeks, notes?, address? }
// `slots` sao os horarios da 1a semana (um por dia da semana escolhido); a serie
// repete cada slot +7 dias por `weeks` semanas. Timezone resolvido no cliente.
export const createStudentEnrollment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      establishmentId,
      serviceId,
      clientId,
      professionalId,
      slots,
      weeks,
      notes,
      address,
    } = req.body;

    // so o dono/equipe pode matricular
    const est = await Establishment.findOne({
      _id: establishmentId,
      $or: [{ owner: req.userId }, { "members.professional": req.userId }],
    });
    if (!est) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    if (!Types.ObjectId.isValid(String(clientId))) {
      res.status(400).json({ message: "Aluno invalido" });
      return;
    }

    const weeksN = Number(weeks);
    if (!Number.isInteger(weeksN) || weeksN < 1 || weeksN > 53) {
      res.status(400).json({ message: "Numero de semanas invalido (1 a 53)" });
      return;
    }
    if (!Array.isArray(slots) || slots.length === 0 || slots.length > 7) {
      res.status(400).json({ message: "Informe de 1 a 7 horarios na semana" });
      return;
    }

    const service = await Service.findById(serviceId);
    if (!service || service.establishment.toString() !== establishmentId) {
      res.status(404).json({ message: "Servico nao encontrado" });
      return;
    }

    const prof = parseProfessional(professionalId);
    const activePros = est.professionals.filter((p) => p.active);
    if (activePros.length > 0 && !prof) {
      res.status(400).json({ message: "Escolha um profissional" });
      return;
    }
    if (prof) {
      const exists = activePros.some((p) => p._id.toString() === prof.toString());
      if (!exists) {
        res.status(404).json({ message: "Profissional nao encontrado ou inativo" });
        return;
      }
    }
    if (!professionalDoesService(service.professionals, prof)) {
      res
        .status(400)
        .json({ message: "Este profissional nao realiza o servico escolhido" });
      return;
    }

    const firstStarts = (slots as unknown[])
      .map((s) => new Date(String(s)))
      .filter((d) => !isNaN(d.getTime()));
    if (firstStarts.length === 0) {
      res.status(400).json({ message: "Horarios invalidos" });
      return;
    }

    // seriesId informado = anexar aulas a uma matricula existente
    const providedSeries = Types.ObjectId.isValid(String(req.body.seriesId))
      ? new Types.ObjectId(String(req.body.seriesId))
      : null;
    const seriesId = providedSeries || new Types.ObjectId();
    const created: unknown[] = [];
    const skipped: { date: string; reason: string }[] = [];

    for (const first of firstStarts) {
      for (let w = 0; w < weeksN; w++) {
        const start = new Date(first);
        start.setDate(start.getDate() + w * 7);
        const end = new Date(start);
        end.setUTCMinutes(end.getUTCMinutes() + service.durationMinutes);

        const bookable = await assertSlotIsBookable(
          service.establishment,
          start,
          end,
          prof
        );
        if (!bookable.ok) {
          skipped.push({
            date: start.toISOString(),
            reason: bookable.reason || "Indisponivel",
          });
          continue;
        }

        // TURMA: valida por vagas; senao, conflito por ocupacao simples
        if (service.classMode === "turma") {
          const st = await turmaSlotStatus(
            service.establishment,
            service._id,
            service.capacity,
            prof,
            start,
            end
          );
          if (!st.ok) {
            skipped.push({ date: start.toISOString(), reason: st.reason || "Indisponivel" });
            continue;
          }
        } else {
          const conflictFilter: Record<string, unknown> = {
            establishment: service.establishment,
            status: { $in: BUSY_STATUSES },
            scheduledAt: { $lt: end },
            endsAt: { $gt: start },
          };
          if (prof) conflictFilter.professional = prof;
          const conflito = await Booking.findOne(conflictFilter);
          if (conflito) {
            skipped.push({ date: start.toISOString(), reason: "Horario ja ocupado" });
            continue;
          }
        }

        // cobranca mensal: as sessoes nao cobram por sessao (amount 0);
        // o plano mensal e cobrado a parte.
        const sessionAmount = service.billing === "mensal" ? 0 : service.price;
        const booking = await Booking.create({
          client: clientId,
          establishment: service.establishment,
          owner: est.owner,
          service: service._id,
          professional: prof,
          seriesId,
          scheduledAt: start,
          endsAt: end,
          status: "confirmado", // matricula pelo estabelecimento ja entra confirmada
          notes,
          address,
          payment: {
            status: "pendente",
            amount: sessionAmount,
            depositRequired: service.billing === "mensal" ? 0 : depositFor(service),
            depositPaid: false,
          },
        });
        created.push(booking);
      }
    }

    if (created.length === 0) {
      res.status(409).json({
        message: "Nenhum horario da serie esta disponivel",
        created: [],
        skipped,
      });
      return;
    }

    // COBRANCA MENSAL: o plano do mes e cobrado UMA vez, na PRIMEIRA aula da
    // serie (as demais R$0). Ao ANEXAR (providedSeries) nao recobra: as aulas
    // extras entram como R$0 (o mes ja foi cobrado na 1a aula original).
    if (!providedSeries && service.billing === "mensal" && service.monthlyPrice > 0) {
      const docs = created as Array<{
        scheduledAt: Date;
        payment: { amount: number };
        save: () => Promise<unknown>;
      }>;
      docs.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
      docs[0].payment.amount = service.monthlyPrice;
      await docs[0].save();
    }

    const recipients = await establishmentRecipients(service.establishment, prof);
    const io = getIO();
    for (const uid of recipients) {
      io.to(`user:${uid}`).emit("booking:new", created[0]);
    }

    res.status(201).json({
      seriesId: seriesId.toString(),
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  } catch (err) {
    console.error("createStudentEnrollment:", err);
    res.status(500).json({ message: "Erro ao matricular o aluno" });
  }
};

// PATCH /api/bookings/:id/attendance  (protegido, dono/equipe)
// body: { attendance: "pendente" | "presente" | "falta" | "reposicao" }
const ATTENDANCE_VALUES = ["pendente", "presente", "falta", "reposicao"];
export const markAttendance = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const value = String(req.body.attendance);
    if (!ATTENDANCE_VALUES.includes(value)) {
      res.status(400).json({ message: "Presenca invalida" });
      return;
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }
    const est = await Establishment.findOne({
      _id: booking.establishment,
      $or: [{ owner: req.userId }, { "members.professional": req.userId }],
    }).select("_id");
    if (!est) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    booking.attendance = value as (typeof booking)["attendance"];
    await booking.save();
    res.json(booking);
  } catch (err) {
    console.error("markAttendance:", err);
    res.status(500).json({ message: "Erro ao marcar presenca" });
  }
};

// DELETE /api/bookings/series/:seriesId  (protegido)
export const cancelSeries = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { seriesId } = req.params;
    if (!Types.ObjectId.isValid(seriesId)) {
      res.status(400).json({ message: "Serie invalida" });
      return;
    }

    const sample = await Booking.findOne({ seriesId });
    if (!sample) {
      res.status(404).json({ message: "Serie nao encontrada" });
      return;
    }

    const isOwner = sample.owner.toString() === req.userId;
    const isClient = sample.client.toString() === req.userId;
    if (!isOwner && !isClient) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    const now = new Date();
    const result = await Booking.updateMany(
      {
        seriesId,
        status: { $in: BUSY_STATUSES },
        scheduledAt: { $gte: now },
      },
      { $set: { status: "cancelado" } }
    );

    // avisa cliente + lado do estabelecimento (dono + funcionario vinculado)
    const estSide = await establishmentRecipients(
      sample.establishment,
      sample.professional
    );
    const io = getIO();
    for (const uid of new Set([sample.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", { seriesId });
    }

    res.json({
      message: "Serie cancelada",
      cancelledCount: result.modifiedCount ?? 0,
    });
  } catch (err) {
    console.error("cancelSeries:", err);
    res.status(500).json({ message: "Erro ao cancelar a serie" });
  }
};

// PATCH /api/bookings/:id/accept-reservation  (protegido, so o cliente)
// aceita uma reserva automatica: vira "pendente" (aguarda confirmacao do dono)
export const acceptReservation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    if (booking.client.toString() !== req.userId) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    if (booking.status !== "reservado") {
      res.status(400).json({ message: "Esta reserva nao esta mais ativa" });
      return;
    }

    // prazo vencido?
    if (
      booking.reservationExpiresAt &&
      booking.reservationExpiresAt.getTime() <= Date.now()
    ) {
      res.status(409).json({ message: "O prazo desta reserva expirou" });
      return;
    }

    booking.status = "pendente";
    booking.reservationExpiresAt = undefined;
    await booking.save();

    // marca a entrada da fila como atendida
    if (booking.fromWaitlist) {
      const { Waitlist } = await import("../models/Waitlist");
      await Waitlist.updateOne(
        { _id: booking.fromWaitlist },
        { $set: { status: "atendido" } }
      );
    }

    // avisa cliente + lado do estabelecimento (dono + funcionario vinculado):
    // agora ha um pendente aguardando confirmacao, e o funcionario do
    // agendamento precisa ve-lo aparecer para confirmar
    const estSide = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const io = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", booking);
    }

    res.json(booking);
  } catch (err) {
    console.error("acceptReservation:", err);
    res.status(500).json({ message: "Erro ao aceitar a reserva" });
  }
};

// PATCH /api/bookings/:id/decline-reservation  (protegido, so o cliente)
// recusa a reserva: cancela e passa a vaga para o proximo da fila
export const declineReservation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    if (booking.client.toString() !== req.userId) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    if (booking.status !== "reservado") {
      res.status(400).json({ message: "Esta reserva nao esta mais ativa" });
      return;
    }

    booking.status = "cancelado";
    booking.reservationExpiresAt = undefined;
    await booking.save();

    // tira a pessoa da fila (ela recusou)
    if (booking.fromWaitlist) {
      const { Waitlist } = await import("../models/Waitlist");
      await Waitlist.updateOne(
        { _id: booking.fromWaitlist },
        { $set: { status: "cancelado" } }
      );
    }

    // avisa cliente + lado do estabelecimento (dono + funcionario vinculado)
    const estSide = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const io = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", booking);
    }

    // passa a vaga para o proximo da fila
    const excluded = booking.fromWaitlist ? [booking.fromWaitlist] : [];
    await autoReserveSlot(
      booking.establishment,
      booking.service,
      booking.professional,
      booking.scheduledAt,
      booking.endsAt,
      excluded
    );

    res.json(booking);
  } catch (err) {
    console.error("declineReservation:", err);
    res.status(500).json({ message: "Erro ao recusar a reserva" });
  }
};

// PATCH /api/bookings/:id/deposit  (protegido, dono/profissional do agendamento)
// registra (ou estorna) o recebimento do sinal. body: { paid: boolean, method? }
export const markDeposit = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const paid = req.body.paid !== false; // default true
    const rawMethod = String(req.body.method || "");
    const method = VALID_METHODS.includes(rawMethod) ? rawMethod : "";

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    // so o estabelecimento registra: dono OU o profissional do agendamento
    const isOwner = booking.owner.toString() === req.userId;
    let isAssignedProfessional = false;
    if (!isOwner && booking.professional) {
      const estProf = await Establishment.findById(
        booking.establishment
      ).select("professionals");
      const prof = estProf?.professionals.id(booking.professional);
      isAssignedProfessional =
        !!prof &&
        !!prof.linkedUser &&
        prof.linkedUser.toString() === req.userId;
    }
    if (!isOwner && !isAssignedProfessional) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    if ((booking.payment.depositRequired || 0) <= 0) {
      res
        .status(400)
        .json({ message: "Este agendamento nao exige sinal" });
      return;
    }

    booking.payment.depositPaid = paid;
    booking.payment.depositPaidAt = paid ? new Date() : undefined;
    booking.payment.depositMethod = paid
      ? (method as typeof booking.payment.depositMethod)
      : "";
    await booking.save();

    // tempo real: cliente + lado do estabelecimento
    const estSide = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const io = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", booking);
    }

    res.json(booking);
  } catch (err) {
    console.error("markDeposit:", err);
    res.status(500).json({ message: "Erro ao registrar o sinal" });
  }
};

// PATCH /api/bookings/:id/extend  (protegido, dono/profissional do agendamento)
// adiciona tempo extra ao atendimento (imprevistos): estende o fim e a
// ocupacao, para nao abrir horario onde o profissional ainda esta ocupado.
// body: { extraMinutes }
export const extendBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const extra = Math.max(0, Math.floor(Number(req.body.extraMinutes)) || 0);
    if (extra <= 0) {
      res.status(400).json({ message: "Informe os minutos extras" });
      return;
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    // so o estabelecimento estende: dono OU o profissional do agendamento
    const isOwner = booking.owner.toString() === req.userId;
    let isAssignedProfessional = false;
    if (!isOwner && booking.professional) {
      const estProf = await Establishment.findById(
        booking.establishment
      ).select("professionals");
      const prof = estProf?.professionals.id(booking.professional);
      isAssignedProfessional =
        !!prof &&
        !!prof.linkedUser &&
        prof.linkedUser.toString() === req.userId;
    }
    if (!isOwner && !isAssignedProfessional) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    if (booking.status === "concluido" || booking.status === "cancelado") {
      res.status(400).json({
        message: "Nao da para estender um agendamento concluido ou cancelado",
      });
      return;
    }

    const MIN = 60000;
    // estende o ULTIMO segmento de ocupacao (fim do atendimento)
    const segs = bookingSegments(booking);
    const extended = segs.map((s, i) =>
      i === segs.length - 1
        ? { start: s.start, end: new Date(s.end.getTime() + extra * MIN) }
        : s
    );

    // nao pode invadir um agendamento logo em seguida
    const conflict = await hasSegmentConflict(
      booking.establishment,
      booking.professional,
      booking.scheduledAt,
      extended,
      booking._id
    );
    if (conflict) {
      res.status(409).json({
        message:
          "Ha outro agendamento logo em seguida; nao da para adicionar esse tempo",
      });
      return;
    }

    booking.endsAt = new Date(booking.endsAt.getTime() + extra * MIN);
    booking.extraMinutes = (booking.extraMinutes || 0) + extra;
    booking.set("busySegments", extended);
    await booking.save();

    // tempo real: cliente + lado do estabelecimento
    const estSide = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    const io = getIO();
    for (const uid of new Set([booking.client.toString(), ...estSide])) {
      io.to(`user:${uid}`).emit("booking:updated", booking);
    }

    res.json(booking);
  } catch (err) {
    console.error("extendBooking:", err);
    res.status(500).json({ message: "Erro ao adicionar tempo extra" });
  }
};