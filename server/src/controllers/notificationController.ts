import { Response } from "express";
import { Notification } from "../models/Notification";
import { Booking } from "../models/Booking";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";

// GET /api/notifications  (protegido)
// lista as notificacoes do usuario logado (mais recentes primeiro)
export const listNotifications = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10))
    );

    const [items, unread] = await Promise.all([
      Notification.find({ user: req.userId })
        .sort({ createdAt: -1 })
        .limit(limit),
      Notification.countDocuments({ user: req.userId, read: false }),
    ]);

    res.json({ items, unread });
  } catch (err) {
    console.error("listNotifications:", err);
    res.status(500).json({ message: "Erro ao listar notificacoes" });
  }
};

// PATCH /api/notifications/read  (protegido)
// marca todas as notificacoes do usuario como lidas
export const markAllRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    await Notification.updateMany(
      { user: req.userId, read: false },
      { $set: { read: true } }
    );
    res.json({ message: "Notificacoes marcadas como lidas", unread: 0 });
  } catch (err) {
    console.error("markAllRead:", err);
    res.status(500).json({ message: "Erro ao marcar notificacoes" });
  }
};

// GET /api/notifications/badges  (protegido)
// contadores das abas:
// - clientPending: agendamentos do cliente com acao do estabelecimento nao vista
// - byEstablishment: { [establishmentId]: quantidade de pendentes }
export const getBadges = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // ---- lado cliente: acoes do estabelecimento ainda nao vistas ----
    const clientPending = await Booking.countDocuments({
      client: req.userId,
      clientNotifiedAt: { $ne: null },
      $or: [
        { clientSeenAt: null },
        { $expr: { $gt: ["$clientNotifiedAt", "$clientSeenAt"] } },
      ],
    });

    // ---- lado estabelecimento: agendamentos aguardando acao ----
    const ests = await Establishment.find({
      $or: [
        { owner: req.userId },
        { "members.professional": req.userId },
      ],
    }).select("owner professionals");

    const byEstablishment: Record<string, number> = {};

    for (const est of ests) {
      const isOwner = est.owner.toString() === req.userId;

      const filter: Record<string, unknown> = {
        establishment: est._id,
        status: "pendente",
      };

      if (!isOwner) {
        // funcionario: so os agendamentos dele
        const prof = est.professionals.find(
          (p) => p.linkedUser && p.linkedUser.toString() === req.userId
        );
        if (!prof) continue;
        filter.professional = prof._id;
      }

      byEstablishment[est._id.toString()] = await Booking.countDocuments(
        filter
      );
    }

    res.json({ clientPending, byEstablishment });
  } catch (err) {
    console.error("getBadges:", err);
    res.status(500).json({ message: "Erro ao carregar contadores" });
  }
};

// PATCH /api/notifications/bookings-seen  (protegido)
// cliente abriu a lista: zera o badge marcando tudo como visto
export const markBookingsSeen = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    await Booking.updateMany(
      { client: req.userId, clientNotifiedAt: { $ne: null } },
      { $set: { clientSeenAt: new Date() } }
    );
    res.json({ message: "Agendamentos marcados como vistos" });
  } catch (err) {
    console.error("markBookingsSeen:", err);
    res.status(500).json({ message: "Erro ao marcar como visto" });
  }
};