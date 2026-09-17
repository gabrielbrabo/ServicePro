// Espaco da galeria = ARMAZENAMENTO (numero de arquivos no S3). O que limita e
// a quantidade de imagens guardadas, nao "quantas fotos" de cada tipo: o dono
// aloca o espaco como quiser (tudo foto normal, tudo antes/depois, ou misto).
//   - foto normal (single) = 1 arquivo  = 1 espaco
//   - antes/depois (ba)     = 2 arquivos = 2 espacos
// Plano inclui um total de espacos; acima disso, compra pacotes extras.
// Ciclo anual = 10x o mensal (2 meses gratis), igual ao resto.

export const INCLUDED_GALLERY_SLOTS = 40; // ex.: 40 normais, ou 20 antes/depois
export const GALLERY_PACK_SLOTS = 20; // cada pacote extra adiciona 20 espacos
export const GALLERY_PACK_MONTHLY_CENTS = 699; // R$ 6,99/mes por pacote

// quantos espacos um item ocupa conforme o tipo
export function slotsForKind(kind: string): number {
  return kind === "ba" ? 2 : 1;
}

// total do ciclo (centavos) para `extraSlots` espacos pagos (multiplo do pacote)
export function galleryCycleTotalCents(
  extraSlots: number,
  cycle: "mensal" | "anual"
): number {
  const packs = Math.ceil((extraSlots || 0) / GALLERY_PACK_SLOTS);
  const m = packs * GALLERY_PACK_MONTHLY_CENTS;
  return cycle === "anual" ? m * 10 : m;
}

// valor a cobrar AGORA ao comprar 1 pacote:
//  - mensal: o mes cheio do pacote
//  - anual: proporcional aos meses que faltam ate a renovacao (minimo 1 mes),
//    pois na proxima renovacao o pacote ja entra embutido no valor anual.
export function nextGalleryPackChargeNowCents(
  cycle: "mensal" | "anual",
  currentPeriodEnd: Date | null
): number {
  const monthly = GALLERY_PACK_MONTHLY_CENTS;
  if (cycle !== "anual") return monthly;
  let months = 12;
  if (currentPeriodEnd) {
    const ms = currentPeriodEnd.getTime() - Date.now();
    months = Math.ceil(ms / (30 * 24 * 60 * 60 * 1000));
  }
  months = Math.min(12, Math.max(1, months));
  return monthly * months;
}
