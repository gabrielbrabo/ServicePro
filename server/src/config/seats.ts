// Assentos de funcionario. O plano inclui 5 funcionarios (a EQUIPE; o dono nao
// conta). Acima disso, cada assento extra e cobrado:
//   - 6o, 7o e 8o funcionario (extras 1..3): R$ 9,99/mes cada
//   - do 9o em diante (extra 4+):            R$ 14,99/mes cada
// Ciclo anual = 10x o mensal (2 meses gratis), igual ao plano base.

export const INCLUDED_SEATS = 5;

// preco MENSAL (centavos) do N-esimo assento EXTRA (extraIndex 1 = 6o func.)
export function seatMonthlyCents(extraIndex: number): number {
  return extraIndex <= 3 ? 999 : 1499;
}

// total mensal (centavos) para `extra` assentos extras
export function seatsMonthlyTotalCents(extra: number): number {
  let total = 0;
  for (let i = 1; i <= extra; i++) total += seatMonthlyCents(i);
  return total;
}

// total do ciclo (centavos): anual = 10x o mensal
export function seatsCycleTotalCents(
  extra: number,
  cycle: "mensal" | "anual"
): number {
  const m = seatsMonthlyTotalCents(extra);
  return cycle === "anual" ? m * 10 : m;
}

// preco do PROXIMO assento (indice currentExtra+1) no ciclo do plano
export function nextSeatCycleCents(
  currentExtra: number,
  cycle: "mensal" | "anual"
): number {
  const m = seatMonthlyCents(currentExtra + 1);
  return cycle === "anual" ? m * 10 : m;
}

// valor a cobrar AGORA ao adicionar o proximo assento:
//  - mensal: o mes cheio do assento
//  - anual: proporcional aos meses que faltam ate a renovacao (minimo 1 mes),
//    pois na proxima renovacao o assento ja entra embutido no valor anual.
export function nextSeatChargeNowCents(
  currentExtra: number,
  cycle: "mensal" | "anual",
  currentPeriodEnd: Date | null
): number {
  const monthly = seatMonthlyCents(currentExtra + 1);
  if (cycle !== "anual") return monthly; // mensal: cobra 1 mes
  // anual: proporcional aos meses restantes (1..12)
  let months = 12;
  if (currentPeriodEnd) {
    const ms = currentPeriodEnd.getTime() - Date.now();
    months = Math.ceil(ms / (30 * 24 * 60 * 60 * 1000));
  }
  months = Math.min(12, Math.max(1, months));
  return monthly * months;
}
