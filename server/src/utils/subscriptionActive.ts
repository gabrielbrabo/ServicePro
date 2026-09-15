import { Subscription } from "../models/Subscription";
import { paymentsConfigured } from "../config/env";

// O estabelecimento pode RECEBER novos agendamentos? (assinatura ativa/trial)
// Sem gateway configurado (dev), sempre true. Assinatura cancelada mas ainda
// dentro do periodo pago segue "active" -> continua recebendo ate vencer.
export async function isEstablishmentActive(
  establishmentId: string
): Promise<boolean> {
  if (!paymentsConfigured()) return true;
  const sub = await Subscription.findOne({
    establishment: establishmentId,
  }).select("status trialEndsAt");
  if (!sub) return false;
  if (sub.status === "trialing") {
    return !sub.trialEndsAt || sub.trialEndsAt.getTime() > Date.now();
  }
  return sub.status === "active";
}
