import { env } from "../../config/env";
import { PaymentProvider } from "./types";
import { noopProvider } from "./noop";
import { asaasProvider } from "./asaas";

// Fabrica do gateway: escolhe o adapter conforme PAYMENTS_PROVIDER.
// Enquanto nenhum estiver ligado, cai no noop (dev, nada bloqueia).
//
// Para ativar o Asaas, no .env do server:
//   PAYMENTS_PROVIDER=asaas
//   ASAAS_API_KEY=<sua chave de sandbox>
//   ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3   (producao: https://api.asaas.com/v3)
//   PAYMENTS_WEBHOOK_SECRET=<token que voce define no webhook do Asaas>
export function getPaymentProvider(): PaymentProvider {
  switch (env.payments.provider) {
    case "asaas":
      return asaasProvider;
    // case "mercadopago":
    //   return mercadoPagoProvider;
    default:
      return noopProvider;
  }
}
