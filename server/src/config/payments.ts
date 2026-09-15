// Valor MINIMO para o cliente pagar/adiantar pelo APP (sinal ou serviço).
// Abaixo disso, o pagamento é combinado por fora do app (a taxa da
// processadora comeria uma fatia grande demais de valores baixos).
// Configurável por env; padrão R$ 20,00. Mantenha espelhado com o client
// (client/src/lib/payments.ts).
export const APP_PAYMENT_MIN_CENTS =
  Number(process.env.APP_PAYMENT_MIN_CENTS) || 2000;

// o valor (em centavos) permite pagamento pelo app?
export function meetsAppPaymentMin(cents: number): boolean {
  return Math.round(cents) >= APP_PAYMENT_MIN_CENTS;
}
