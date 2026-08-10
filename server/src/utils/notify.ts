import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification";
import { Establishment } from "../models/Establishment";
import { getIO } from "../socket";

interface NotifyArgs {
  user: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  body?: string;
  booking?: Types.ObjectId | string | null;
  establishment?: Types.ObjectId | string | null;
}

// payload sem o destinatario: usado no envio em lote
type NotifyPayload = Omit<NotifyArgs, "user">;

// cria a notificacao e avisa em tempo real quem estiver com o app aberto.
// FALHA SILENCIOSA: notificacao nunca derruba a operacao principal.
export const notify = async (args: NotifyArgs): Promise<void> => {
  await notifyMany([args.user], {
    type: args.type,
    title: args.title,
    body: args.body,
    booking: args.booking,
    establishment: args.establishment,
  });
};

// Envia a MESMA notificacao para varios destinatarios.
// Usa insertMany (uma unica ida ao banco) em vez de N inserts sequenciais —
// o custo e praticamente o mesmo para 2 ou para 2.000 destinatarios.
export const notifyMany = async (
  users: Array<Types.ObjectId | string>,
  payload: NotifyPayload
): Promise<void> => {
  try {
    if (users.length === 0) return;

    // remove duplicatas (o dono pode ser o proprio profissional)
    const unique = Array.from(new Set(users.map((u) => String(u))));

    const docs = unique.map((user) => ({
      user,
      type: payload.type,
      title: payload.title,
      body: payload.body || "",
      booking: payload.booking || null,
      establishment: payload.establishment || null,
      read: false,
    }));

    const created = await Notification.insertMany(docs, { ordered: false });

    // emite em paralelo; socket nao espera confirmacao
    const io = getIO();
    for (const doc of created) {
      io.to(`user:${doc.user.toString()}`).emit("notification:new", doc);
    }
  } catch (err) {
    console.error("notifyMany:", err);
  }
};

// Dispara sem bloquear a resposta HTTP. A notificacao e um efeito colateral:
// o usuario nao deve esperar por ela para receber a confirmacao da acao.
// Erros sao engolidos de proposito (ja logados dentro de notifyMany).
export const notifyManyAsync = (
  users: Array<Types.ObjectId | string>,
  payload: NotifyPayload
): void => {
  void notifyMany(users, payload);
};

// Descobre quem deve ser avisado no lado do estabelecimento: o dono e, se o
// agendamento tem profissional vinculado a um login, tambem o funcionario.
export const establishmentRecipients = async (
  establishmentId: Types.ObjectId | string,
  professionalId?: Types.ObjectId | null
): Promise<string[]> => {
  try {
    const est = await Establishment.findById(establishmentId).select(
      "owner professionals"
    );
    if (!est) return [];

    const ids = new Set<string>();
    ids.add(est.owner.toString());

    if (professionalId) {
      const prof = est.professionals.id(professionalId);
      if (prof?.linkedUser) {
        ids.add(prof.linkedUser.toString());
      }
    }

    return Array.from(ids);
  } catch (err) {
    console.error("establishmentRecipients:", err);
    return [];
  }
};