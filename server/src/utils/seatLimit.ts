import { Types } from "mongoose";
import { Subscription } from "../models/Subscription";
import { INCLUDED_SEATS } from "../config/seats";

// Trava de funcionarios: 5 incluidos + assentos pagos. O dono NAO conta.
// Assentos consumidos = profissionais ativos + secretarias(os) ALEM da 1a
// (a primeira secretaria e gratis; da 2a em diante cada uma ocupa 1 assento).

type ProfLike = { active?: boolean; linkedUser?: Types.ObjectId | null };
type MemberLike = { active?: boolean; role?: string };

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

// secretarias(os) ativas (membros com role "secretary")
export function secretaryCount(est: { members?: MemberLike[] }): number {
  return (est.members || []).filter(
    (m) => m.active && m.role === "secretary"
  ).length;
}

// SECRETARY_FREE: quantas secretarias nao ocupam assento (1a gratis)
export const SECRETARY_FREE = 1;

// assentos consumidos = profissionais + secretarias que passam da cota gratis
export function usedSeats(est: {
  owner: Types.ObjectId;
  professionals: ProfLike[];
  members?: MemberLike[];
}): number {
  const billedSecretaries = Math.max(
    0,
    secretaryCount(est) - SECRETARY_FREE
  );
  return teamCount(est) + billedSecretaries;
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
