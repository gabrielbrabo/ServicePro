// Areas (segmentos) do sistema e os modulos que cada uma libera.
// O painel esconde abas fora da area e o middleware requireModule protege as
// rotas. O preco por area sera usado depois pelo sistema de cobranca.
//
// Alem da area, uma CATEGORIA pode liberar modulos extras (ex.: odontologia
// libera o odontograma dentro da area Saude).
//
// IMPORTANTE: manter espelhado com client/src/lib/segments.ts (mesmos dados).

export type SegmentKey = "geral" | "beleza" | "saude";

export type ModuleKey =
  // comuns / operacao
  | "servicos"
  | "equipe"
  | "agenda" // expediente
  | "recebidos" // agendamentos recebidos
  | "clientes"
  | "caixa"
  | "comissoes"
  | "avaliacoes"
  // beleza / estetica
  | "galeria" // antes-depois
  | "produtos" // estoque
  // saude
  | "prontuario"
  | "anamnese"
  | "plano_tratamento"
  | "documentos"
  | "convenio" // gestao de convenio (TISS/TUSS) — Fase 1
  | "auditoria" // auditoria LGPD de acesso a dados de paciente
  // odontologia (extra por categoria)
  | "odontograma"
  // fisioterapia (extra por categoria)
  | "fisioterapia";

export interface SegmentDef {
  key: SegmentKey;
  label: string;
  description: string;
  priceMonthly: number; // R$/mes
  modules: ModuleKey[];
}

// modulos comuns a todas as areas
const COMMON: ModuleKey[] = [
  "servicos",
  "equipe",
  "agenda",
  "recebidos",
  "clientes",
  "caixa",
  "comissoes",
  "avaliacoes",
  "galeria",
];

export const SEGMENTS: Record<SegmentKey, SegmentDef> = {
  geral: {
    key: "geral",
    label: "Serviços gerais",
    description: "Lava-rápido, assistência e outros serviços por agendamento.",
    priceMonthly: 29,
    modules: [...COMMON],
  },
  beleza: {
    key: "beleza",
    label: "Beleza e bem-estar",
    description: "Barbearia, salão, estética, sobrancelha, etc.",
    priceMonthly: 39,
    modules: [...COMMON, "produtos"],
  },
  saude: {
    key: "saude",
    label: "Saúde",
    description: "Clínicas, odontologia e fisioterapia.",
    priceMonthly: 89,
    modules: [
      ...COMMON,
      "produtos",
      "prontuario",
      "anamnese",
      "plano_tratamento",
      "documentos",
      "convenio",
      "auditoria",
    ],
  },
};

// modulos extras liberados por CATEGORIA (slug), somados aos da area.
export const CATEGORY_EXTRA_MODULES: Record<string, ModuleKey[]> = {
  odontologia: ["odontograma"],
  fisioterapia: ["fisioterapia"],
};

// area padrao dos estabelecimentos antigos (sem segment gravado)
export const DEFAULT_SEGMENT: SegmentKey = "beleza";

export function isSegment(v: unknown): v is SegmentKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SEGMENTS, v);
}

export function segmentModules(segment?: string): ModuleKey[] {
  const key = isSegment(segment) ? segment : DEFAULT_SEGMENT;
  return SEGMENTS[key].modules;
}

// modulos da area + extras da categoria (se houver)
export function modulesFor(segment?: string, categorySlug?: string): ModuleKey[] {
  const base = segmentModules(segment);
  const extra = (categorySlug && CATEGORY_EXTRA_MODULES[categorySlug]) || [];
  return Array.from(new Set([...base, ...extra]));
}

export function hasModule(
  segment: string | undefined,
  mod: ModuleKey,
  categorySlug?: string
): boolean {
  return modulesFor(segment, categorySlug).includes(mod);
}
