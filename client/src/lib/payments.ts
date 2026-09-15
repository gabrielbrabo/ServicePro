// Valor MINIMO para pagamentos/sinais pelo app (espelhar com o server:
// server/src/config/payments.ts -> APP_PAYMENT_MIN_CENTS). Abaixo disso o
// cliente paga por fora do app.
export const APP_PAYMENT_MIN_CENTS = 2000;
export const APP_PAYMENT_MIN_LABEL = "R$ 20,00";

export function meetsAppPaymentMin(cents: number): boolean {
  return Math.round(cents) >= APP_PAYMENT_MIN_CENTS;
}
