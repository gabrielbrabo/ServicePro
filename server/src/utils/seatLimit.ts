import { Types } from "mongoose";
import { Subscription } from "../models/Subscription";
import { INCLUDED_SEATS } from "../config/seats";

// Trava de funcionarios: 5 incluidos + assentos pagos. O dono NAO conta.

type ProfLike = { active?: boolean; linkedUser?: Types.ObjectId | null };

// conta a EQUIPE (funcionarios ativos) — exclui o profissional do proprio dono
export function teamCount(est: {
  owner: Types.ObjectId;
  professionals: ProfLike[];
}): number {
  const ownerId = est.owner.toString();
  return est.professionals.filter(
    (p) => p.active && (!p.linkedUser || p.linkedUser.toString() !== ownerId)
  ).length;
}

// assentos extras pagos na assinatura do estabelecimento
export async function paidExtraSeats(
  establishmentId: Types.ObjectId | string
): Promise<number> {
  const sub = await Subscription.findOne({
    establishment: establishmentId,
  }).select("extraSeats");
  return sub?.extraSeats || 0;
}

// limite total de equipe = incluidos + assentos pagos
export function maxTeam(extraSeats: number): number {
  return INCLUDED_SEATS + (extraSeats || 0);
}
