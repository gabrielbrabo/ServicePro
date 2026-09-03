import { Request, Response } from "express";
import { Types } from "mongoose";
import { Review } from "../models/Review";
import { Booking, IBooking } from "../models/Booking";
import { Establishment } from "../models/Establishment";
import { Service } from "../models/Service";
import { AuthRequest } from "../middleware/auth";
import { notifyManyAsync, establishmentRecipients } from "../utils/notify";
import { applyLoyaltyOnReview } from "./loyaltyController";
import { verifyReviewToken } from "../utils/reviewToken";

// Recalcula media e total de avaliacoes do estabelecimento e grava no doc.
// Mantido aqui para os cards/busca/perfil lerem a nota sem tocar em Review.
async function recomputeEstablishmentRating(
  establishmentId: Types.ObjectId | string
): Promise<{ ratingAvg: number; ratingCount: number }> {
  const agg = await Review.aggregate<{ _id: unknown; avg: number; count: number }>([
    { $match: { establishment: new Types.ObjectId(String(establishmentId)) } },
    {
      $group: {
        _id: "$establishment",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const ratingCount = agg[0]?.count ?? 0;
  // 1 casa decimal (ex.: 4.8); 0 quando nao ha avaliacoes
  const ratingAvg = ratingCount ? Math.round(agg[0].avg * 10) / 10 : 0;

  await Establishment.updateOne(
    { _id: establishmentId },
    { $set: { ratingAvg, ratingCount } }
  );

  return { ratingAvg, ratingCount };
}

// Nucleo compartilhado: grava/atualiza a avaliacao de um agendamento concluido,
// recalcula a nota, avisa o estabelecimento e concede o carimbo bonus (1a vez).
// Usado tanto pela rota autenticada quanto pela rota de token (1 toque).
async function writeReview(args: {
  booking: IBooking;
  rating: number;
  comment?: string;
}): Promise<{ ratingAvg: number; ratingCount: number; isNew: boolean }> {
  const { booking, rating, comment } = args;

  const cleanComment =
    typeof comment === "string" && comment.trim()
      ? comment.trim().slice(0, 1000)
      : undefined;

  // ja existe avaliacao deste atendimento? (define se e a primeira)
  const existing = await Review.findOne({ booking: booking._id }).select("_id");

  await Review.findOneAndUpdate(
    { booking: booking._id },
    {
      $set: { rating, comment: cleanComment },
      $setOnInsert: {
        client: booking.client,
        service: booking.service,
        establishment: booking.establishment,
        professional: booking.professional,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // marca o agendamento como avaliado (nao pede avaliacao de novo)
  if (!booking.reviewed) {
    booking.reviewed = true;
    await booking.save();
  }

  const totals = await recomputeEstablishmentRating(booking.establishment);
  const isNew = !existing;

  // so na PRIMEIRA avaliacao deste atendimento: avisa o estabelecimento e
  // concede o carimbo bonus de fidelidade (se o programa permitir).
  if (isNew) {
    const svc = await Service.findById(booking.service).select("title");
    const serviceTitle = svc?.title || "um servico";
    const recipients = await establishmentRecipients(
      booking.establishment,
      booking.professional
    );
    notifyManyAsync(recipients, {
      type: "review_received",
      title: "Nova avaliacao",
      body: `${rating} estrela${rating > 1 ? "s" : ""} em ${serviceTitle}`,
      booking: booking._id,
      establishment: booking.establishment,
    });

    // +1 carimbo por avaliar (fire-and-forget; o cliente e o "autor")
    void applyLoyaltyOnReview(
      booking.establishment,
      booking.client,
      booking.client
    );
  }

  return { ...totals, isNew };
}

const validRating = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

// POST /api/reviews  (protegido)
// body: { bookingId, rating (1..5), comment? }
export const createOrUpdateReview = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { bookingId, rating, comment } = req.body;

    const ratingNum = validRating(rating);
    if (ratingNum === null) {
      res.status(400).json({ message: "Nota deve ser de 1 a 5 estrelas" });
      return;
    }
    if (!bookingId || !Types.ObjectId.isValid(String(bookingId))) {
      res.status(400).json({ message: "Agendamento invalido" });
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }
    if (booking.client.toString() !== req.userId) {
      res
        .status(403)
        .json({ message: "Sem permissao para avaliar este agendamento" });
      return;
    }
    if (booking.status !== "concluido") {
      res
        .status(400)
        .json({ message: "So e possivel avaliar um atendimento concluido" });
      return;
    }

    const totals = await writeReview({ booking, rating: ratingNum, comment });
    const review = await Review.findOne({ booking: booking._id });
    res.status(201).json({ review, ratingAvg: totals.ratingAvg, ratingCount: totals.ratingCount });
  } catch (err) {
    console.error("createOrUpdateReview:", err);
    res.status(500).json({ message: "Erro ao registrar avaliacao" });
  }
};

// GET /api/reviews/booking/:bookingId  (protegido)
export const getReviewByBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    if (!Types.ObjectId.isValid(String(bookingId))) {
      res.status(400).json({ message: "Agendamento invalido" });
      return;
    }

    const booking = await Booking.findById(bookingId).select("client service");
    if (!booking) {
      res.json({ review: null });
      return;
    }
    if (booking.client.toString() !== req.userId) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    const review = await Review.findOne({ booking: bookingId });
    res.json({ review: review || null });
  } catch (err) {
    console.error("getReviewByBooking:", err);
    res.status(500).json({ message: "Erro ao buscar avaliacao" });
  }
};

// ============ AVALIACAO EM 1 TOQUE (token, sem login) ============

// nome do profissional (subdoc) para exibir na pagina de avaliacao
async function professionalName(
  establishmentId: Types.ObjectId,
  professionalId: Types.ObjectId | null
): Promise<string | null> {
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
}

// GET /api/reviews/link/:token  (publico) — dados para montar a pagina
export const getReviewByToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const bookingId = verifyReviewToken(req.params.token);
    if (!bookingId) {
      res.status(400).json({ message: "Link invalido ou expirado" });
      return;
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }

    const [est, svc, review] = await Promise.all([
      Establishment.findById(booking.establishment).select("name"),
      Service.findById(booking.service).select("title"),
      Review.findOne({ booking: booking._id }).select("rating comment"),
    ]);

    res.json({
      establishmentName: est?.name || "o estabelecimento",
      serviceTitle: svc?.title || "seu atendimento",
      professionalName: await professionalName(
        booking.establishment,
        booking.professional
      ),
      canReview: booking.status === "concluido",
      currentRating: review?.rating ?? null,
      currentComment: review?.comment ?? "",
    });
  } catch (err) {
    console.error("getReviewByToken:", err);
    res.status(500).json({ message: "Erro ao abrir avaliacao" });
  }
};

// POST /api/reviews/link/:token  (publico) — grava a nota em 1 toque
export const submitReviewByToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const bookingId = verifyReviewToken(req.params.token);
    if (!bookingId) {
      res.status(400).json({ message: "Link invalido ou expirado" });
      return;
    }
    const ratingNum = validRating(req.body.rating);
    if (ratingNum === null) {
      res.status(400).json({ message: "Nota deve ser de 1 a 5 estrelas" });
      return;
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ message: "Agendamento nao encontrado" });
      return;
    }
    if (booking.status !== "concluido") {
      res
        .status(400)
        .json({ message: "So e possivel avaliar um atendimento concluido" });
      return;
    }

    const totals = await writeReview({
      booking,
      rating: ratingNum,
      comment: req.body.comment,
    });
    res.status(201).json({ ok: true, ...totals });
  } catch (err) {
    console.error("submitReviewByToken:", err);
    res.status(500).json({ message: "Erro ao registrar avaliacao" });
  }
};

// GET /api/reviews/establishment/:establishmentId  (protegido, dono/equipe)
export const listEstablishmentReviews = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!Types.ObjectId.isValid(String(establishmentId))) {
      res.status(400).json({ message: "Estabelecimento invalido" });
      return;
    }

    const est = await Establishment.findOne({
      _id: establishmentId,
      $or: [{ owner: req.userId }, { "members.professional": req.userId }],
    }).select("_id ratingAvg ratingCount");
    if (!est) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const reviews = await Review.find({ establishment: establishmentId })
      .populate("client", "name avatar")
      .populate("service", "title")
      .sort({ createdAt: -1 });

    res.json({
      reviews,
      ratingAvg: est.ratingAvg ?? 0,
      ratingCount: est.ratingCount ?? 0,
    });
  } catch (err) {
    console.error("listEstablishmentReviews:", err);
    res.status(500).json({ message: "Erro ao listar avaliacoes" });
  }
};

// GET /api/reviews/public/:establishmentId  (publico)
export const listPublicReviews = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!Types.ObjectId.isValid(String(establishmentId))) {
      res.status(400).json({ message: "Estabelecimento invalido" });
      return;
    }

    const reviews = await Review.find({ establishment: establishmentId })
      .populate("client", "name avatar")
      .populate("service", "title")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ reviews });
  } catch (err) {
    console.error("listPublicReviews:", err);
    res.status(500).json({ message: "Erro ao listar avaliacoes" });
  }
};
