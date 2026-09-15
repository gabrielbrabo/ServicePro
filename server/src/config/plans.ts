import { SEGMENTS, SegmentKey } from "./segments";

// O "plano" da assinatura é a ÁREA (segmento) do estabelecimento. Cada área tem
// seu preço em SEGMENTS[...].priceMonthly (config/segments.ts). Aqui só
// convertemos para o formato de plano usado pela cobrança (preço em centavos).
// Ciclo anual = 2 meses grátis (paga 10 meses).

export interface Plan {
  id: string; // = a chave do segmento (geral | beleza | saude)
  name: string;
  monthlyCents: number;
  description?: string;
}

export const PLANS: Record<string, Plan> = Object.fromEntries(
  (Object.keys(SEGMENTS) as SegmentKey[]).map((k) => {
    const s = SEGMENTS[k];
    return [
      k,
      {
        id: k,
        name: s.label,
        monthlyCents: Math.round(s.priceMonthly * 100),
        description: s.description,
      } as Plan,
    ];
  })
) as Record<string, Plan>;

export const DEFAULT_PLAN_ID = "beleza";

export function getPlan(id?: string | null): Plan | null {
  if (!id) return null;
  return PLANS[id] ?? null;
}

// preço final em centavos conforme o ciclo. anual = 10x o mensal (2 meses grátis)
export function priceForCycle(plan: Plan, cycle: "mensal" | "anual"): number {
  return cycle === "anual" ? plan.monthlyCents * 10 : plan.monthlyCents;
}
