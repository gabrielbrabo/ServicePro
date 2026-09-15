import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { Subscription } from "../models/Subscription";
import { paymentsConfigured } from "../config/env";

// Bloqueia a rota se o estabelecimento NAO tiver assinatura ativa (ou em trial).
// Descobre o id do estabelecimento em params (:establishmentId ou :id) ou body.
//
// IMPORTANTE: so ativa de verdade quando um gateway estiver configurado
// (PAYMENTS_PROVIDER). Sem gateway (dev), libera tudo — assim nada quebra
// enquanto a cobranca nao esta no ar.
//
// Uso (quando quiser proteger uma rota paga):
//   router.post("/:establishmentId/algo", protect,
//     requireActiveSubscription, handler);
export async function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // dev / gateway desligado: nao bloqueia
    if (!paymentsConfigured()) {
      next();
      return;
    }

    const estId =
      (req.params.establishmentId as string | undefined) ||
      (req.params.id as string | undefined) ||
      (req.body?.establishment as string | undefined);

    if (!estId) {
      res.status(400).json({ message: "Estabelecimento nao informado" });
      return;
    }

    const sub = await Subscription.findOne({ establishment: estId });

    const entitled =
      !!sub &&
      (sub.status === "active" ||
        (sub.status === "trialing" &&
          (!sub.trialEndsAt || sub.trialEndsAt.getTime() > Date.now())));

    if (!entitled) {
      res.status(402).json({
        message: "Assinatura inativa. Regularize o pagamento para continuar.",
        status: sub?.status ?? "none",
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({ message: "Erro ao validar a assinatura" });
  }
}
