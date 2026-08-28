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
  | "galeria" // antes-depois (portfolio publico)
  | "produtos" // estoque
  | "ficha" // ficha tecnica do cliente (prontuario da beleza)
  | "formulas" // historico de formulas quimicas por cliente
  | "antes_depois" // fotos antes/depois por cliente (privado)
  | "pacotes" // pacotes de sessoes pre-pagas por cliente
  | "fidelidade" // programa de fidelidade (carimbos) por cliente
  | "consentimento" // termos de consentimento / autorizacao de imagem
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
  | "fisioterapia"
  // tatuagem (extra por categoria)
  | "tattoo"
  // estetica (extra por categoria): avaliacao + mapa de aplicacao
  | "estetica"
  // sobrancelha & cilios (extra por categoria): perfil tecnico / mapping
  | "visagismo"
  // manicure & pedicure (extra por categoria): controle de esterilizacao
  | "esterilizacao"
  // massagem (extra por categoria): avaliacao + evolucao por sessao
  | "massagem"
  // servicos gerais (base): ordem de servico (OS)
  | "ordem_servico"
  // veiculos (extra por categoria): dados do veiculo + checklist na OS
  | "veiculo"
  // assistencia tecnica (extra): dados do equipamento + laudo tecnico na OS
  | "equipamento"
  // dedetizacao (extra): certificado (praga-alvo, produtos, proxima aplicacao)
  | "dedetizacao";

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
    priceMonthly: 39,
    modules: [...COMMON, "ordem_servico"],
  },
  beleza: {
    key: "beleza",
    label: "Beleza e bem-estar",
    description: "Barbearia, salão, estética, sobrancelha, etc.",
    priceMonthly: 69,
    modules: [
      ...COMMON,
      "produtos",
      "ficha",
      "formulas",
      "antes_depois",
      "pacotes",
      "fidelidade",
      "consentimento",
    ],
  },
  saude: {
    key: "saude",
    label: "Saúde",
    description: "Clínicas, odontologia e fisioterapia.",
    priceMonthly: 149,
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
  tatuagem: ["tattoo"],
  estetica: ["estetica"],
  "sobrancelha-cilios": ["visagismo"],
  "manicure-pedicure": ["esterilizacao"],
  massagem: ["massagem"],
  // veiculos (servicos gerais)
  "oficina-mecanica": ["veiculo"],
  borracharia: ["veiculo"],
  "estetica-automotiva": ["veiculo"],
  "lava-rapido": ["veiculo"],
  // assistencia tecnica
  "assistencia-tecnica": ["equipamento"],
  // dedetizacao
  dedetizacao: ["dedetizacao"],
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
