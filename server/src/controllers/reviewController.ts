import { Request, Response } from "express";
import { Types } from "mongoose";
import { Review } from "../models/Review";
import { Booking } from "../models/Booking";
import { Establishment } from "../models/Establishment";
import { Service } from "../models/Service";
import { AuthRequest } from "../middleware/auth";
import { notifyManyAsync, establishmentRecipients } from "../utils/notify";

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

// POST /api/reviews  (protegido)
// body: { bookingId, rating (1..5), comment? }
// Cria ou atualiza a avaliacao do cliente para o SERVICO daquele agendamento.
// Regra: uma avaliacao por (cliente + servico). Reavaliar sobrescreve a nota.
export const createOrUpdateReview = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { bookingId, rating, comment } = req.body;

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
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

    // so o cliente do agendamento pode avaliar
    if (booking.client.toString() !== req.userId) {
      res
        .status(403)
        .json({ message: "Sem permissao para avaliar este agendamento" });
      return;
    }

    // so avalia atendimento concluido
    if (booking.status !== "concluido") {
      res
        .status(400)
        .json({ message: "So e possivel avaliar um atendimento concluido" });
      return;
    }

    const cleanComment =
      typeof comment === "string" && comment.trim()
        ? comment.trim().slice(0, 1000)
        : undefined;

    // ja existe avaliacao deste cliente para este servico? (define se e nova)
    const existing = await Review.findOne({
      client: booking.client,
      service: booking.service,
    }).select("_id");

    // upsert por (cliente + servico): reavaliar sobrescreve a nota do servico.
    // client e service estao no filtro -> NAO repetir no update (evita conflito).
    const review = await Review.findOneAndUpdate(
      { client: booking.client, service: booking.service },
      {
        $set: {
          rating: ratingNum,
          comment: cleanComment,
          booking: booking._id,
        },
        $setOnInsert: {
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

    // avisa o estabelecimento (dono + funcionario) SO quando e avaliacao nova
    if (!existing) {
      const svc = await Service.findById(booking.service).select("title");
      const serviceTitle = svc?.title || "um servico";
      const recipients = await establishmentRecipients(
        booking.establishment,
        booking.professional
      );
      notifyManyAsync(recipients, {
        type: "review_received",
        title: "Nova avaliacao",
        body: `${ratingNum} estrela${ratingNum > 1 ? "s" : ""} em ${serviceTitle}`,
        booking: booking._id,
        establishment: booking.establishment,
      });
    }

    res.status(201).json({ review, ...totals });
  } catch (err) {
    console.error("createOrUpdateReview:", err);
    res.status(500).json({ message: "Erro ao registrar avaliacao" });
  }
};

// GET /api/reviews/booking/:bookingId  (protegido)
// Devolve a avaliacao do cliente para o SERVICO daquele agendamento (para
// preencher/editar o modal), ou null.
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

    // so o proprio cliente ve a sua avaliacao
    if (booking.client.toString() !== req.userId) {
      res.status(403).json({ message: "Sem permissao" });
      return;
    }

    const review = await Review.findOne({
      client: booking.client,
      service: booking.service,
    });

    res.json({ review: review || null });
  } catch (err) {
    console.error("getReviewByBooking:", err);
    res.status(500).json({ message: "Erro ao buscar avaliacao" });
  }
};

// GET /api/reviews/establishment/:establishmentId  (protegido, dono/equipe)
// Lista as avaliacoes recebidas pelo estabelecimento (para o dono/funcionario
// ler no modal). Traz nome do cliente e titulo do servico.
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

    // so dono ou membro (funcionario) do estabelecimento pode ver
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
// Avaliacoes visiveis para qualquer visitante (carrossel na pagina do
// estabelecimento). Traz nome/foto do cliente e titulo do servico.
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