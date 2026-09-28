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

// Estabelecimento no PERIODO GRATIS de cupom (ainda nao pagou nenhuma
// cobranca)? Enquanto estiver, os recebimentos pelo app ficam bloqueados:
// abrir a conta de recebimento (subconta Asaas) tem custo para a plataforma e
// o estabelecimento ainda nao pagou nada. Libera quando o 1o pagamento da
// assinatura confirmar (status "active"). Cupom de desconto nao bloqueia.
export async function isInFreeTrial(establishmentId: unknown): Promise<boolean> {
  if (!paymentsConfigured()) return false;
  const sub = await Subscription.findOne({
    establishment: establishmentId,
  }).select("status");
  return sub?.status === "trialing";
}

export const FREE_TRIAL_RECEIVABLES_MSG =
  "Recebimentos pelo app ficam disponíveis depois que você assinar um plano (durante o período grátis do cupom eles ficam bloqueados).";
