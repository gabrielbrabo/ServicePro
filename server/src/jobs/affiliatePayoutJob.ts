import { settleAllDeferredAffiliates } from "../utils/affiliateAccount";

// Acerto dos afiliados do modelo "deferred" (subconta aberta so no 1o indicado
// pagante): reabre contas que falharam, aplica o split quando a conta e
// aprovada e repassa as comissoes que entraram antes da aprovacao.
// O painel e o webhook tambem disparam o acerto; o job e a rede de seguranca.
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

let timer: NodeJS.Timeout | null = null;
let running = false;

export const startAffiliatePayoutJob = (): void => {
  if (timer) return;

  const tick = async () => {
    if (running) return; // nao sobrepoe rodadas
    running = true;
    try {
      await settleAllDeferredAffiliates();
    } catch (err) {
      console.error("affiliatePayoutJob:", err);
    } finally {
      running = false;
    }
  };

  // primeira rodada alguns minutos depois da subida (nao pesa no boot)
  setTimeout(() => void tick(), 3 * 60 * 1000);
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  console.log("💸 Job de repasse de afiliados iniciado");
};
