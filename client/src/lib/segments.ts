// Espelho de server/src/config/segments.ts — MANTER OS DOIS IGUAIS.

export type SegmentKey = "geral" | "beleza" | "saude";

export type ModuleKey =
  | "servicos"
  | "equipe"
  | "agenda"
  | "recebidos"
  | "clientes"
  | "caixa"
  | "comissoes"
  | "avaliacoes"
  | "galeria"
  | "produtos"
  | "ficha"
  | "formulas"
  | "antes_depois"
  | "pacotes"
  | "fidelidade"
  | "consentimento"
  | "prontuario"
  | "anamnese"
  | "plano_tratamento"
  | "documentos"
  | "convenio"
  | "auditoria"
  | "ficha_clinica"
  | "anamnese_link"
  | "odontograma"
  | "fisioterapia"
  | "tattoo"
  | "estetica"
  | "visagismo"
  | "esterilizacao"
  | "massagem"
  | "ordem_servico"
  | "veiculo"
  | "equipamento"
  | "dedetizacao"
  | "garantia"
  | "medidas"
  | "aulas"
  | "manutencao"
  | "foto"
  | "obra"
  | "personal"
  | "nutricao"
  | "podologia"
  | "enfermagem"
  | "dermatologia"
  | "quiropraxia"
  | "acupuntura";

export interface SegmentDef {
  key: SegmentKey;
  label: string;
  description: string;
  priceMonthly: number;
  modules: ModuleKey[];
}

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
  "fidelidade",
];

export const SEGMENTS: Record<SegmentKey, SegmentDef> = {
  geral: {
    key: "geral",
    label: "Serviços gerais",
    description:
      "Limpeza e diarista, aulas particulares, reformas e construção e outros serviços por agendamento.",
    priceMonthly: 69,
    modules: [...COMMON, "ordem_servico"],
  },
  beleza: {
    key: "beleza",
    label: "Beleza e bem-estar",
    description: "Barbearia, salão de beleza, estética, manicure e pedicure.",
    priceMonthly: 69,
    modules: [
      ...COMMON,
      "produtos",
      "ficha",
      "formulas",
      "antes_depois",
      "pacotes",
      "consentimento",
    ],
  },
  saude: {
    key: "saude",
    label: "Saúde",
    description: "Odontologia, fisioterapia, quiropraxia, enfermagem, psicologia.",
    priceMonthly: 159,
    modules: [
      ...COMMON,
      "produtos",
      "prontuario",
      "anamnese",
      "plano_tratamento",
      "documentos",
      "convenio",
      "auditoria",
      "anamnese_link",
    ],
  },
};

// modulos extras por categoria (slug), somados aos da area
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
  "estetica-automotiva": ["veiculo"],
  "lava-rapido": ["veiculo"],
  // chaveiro: dados do veiculo p/ chave automotiva (na OS)
  chaveiro: ["veiculo"],
  // assistencia tecnica
  "assistencia-tecnica": ["equipamento"],
  // dedetizacao
  dedetizacao: ["dedetizacao"],
  // termo de garantia (refrigeracao, eletrica e hidraulica)
  refrigeracao: ["garantia", "manutencao"],
  "eletrica-hidraulica": ["garantia"],
  // costura / ajustes: ficha de medidas
  "costura-ajustes": ["medidas"],
  // aulas particulares: plano de aulas + frequencia
  "aulas-particulares": ["aulas"],
  // jardinagem e paisagismo: plano de manutencao recorrente
  "jardinagem-paisagismo": ["manutencao"],
  // fotografia: briefing/contrato + galeria de entrega
  fotografia: ["foto"],
  // reformas e construcao: orcamento por etapas + medicoes + agenda
  "reformas-construcao": ["obra"],
  // pintura: trabalho faseado -> obras (etapas + medicoes + diarias)
  pintura: ["obra"],
  // limpeza e diarista: plano recorrente (faxina semanal/quinzenal)
  "limpeza-diarista": ["manutencao"],
  // personal trainer: ficha do aluno
  "personal-trainer": ["personal"],
  // nutricao: antropometria + plano alimentar + metas
  nutricao: ["nutricao"],
  // podologia: mapa do pe + procedimentos + antes/depois
  podologia: ["podologia"],
  // enfermagem: sinais vitais + curativos + medicacao + retorno
  enfermagem: ["enfermagem"],
  // dermatologia: mapa de lesoes + antes/depois + retorno
  dermatologia: ["dermatologia"],
  // quiropraxia: avaliacao postural + registro de ajustes + retorno
  quiropraxia: ["quiropraxia"],
  // acupuntura: pontos aplicados por sessao + retorno
  acupuntura: ["acupuntura"],
};

// Mapa fallback slug -> area, usado quando a categoria AINDA nao tem `segment`
// gravado no banco (o campo do banco, quando existe, tem prioridade).
// Para novas categorias no futuro: adicione o slug aqui OU grave `segment`
// direto no documento da categoria.
export const CATEGORY_SEGMENT: Record<string, SegmentKey> = {
  barbearia: "beleza",
  "salao-de-beleza": "beleza",
  estetica: "beleza",
  "manicure-pedicure": "beleza",
  massagem: "beleza",
  tatuagem: "beleza",
  "sobrancelha-cilios": "beleza",
  depilacao: "beleza",
  "maquiagem-penteados": "beleza",
  bronzeamento: "beleza",
  clinica: "saude",
  odontologia: "saude",
  fisioterapia: "saude",
  psicologia: "saude",
  nutricao: "saude",
  fonoaudiologia: "saude",
  dermatologia: "saude",
  podologia: "saude",
  enfermagem: "saude",
  acupuntura: "saude",
  quiropraxia: "saude",
  "lava-rapido": "geral",
};

// resolve a area de uma categoria: usa o campo do banco; senao, o mapa por slug
export function categorySegment(cat: {
  segment?: string;
  slug?: string;
}): SegmentKey | undefined {
  if (isSegment(cat.segment)) return cat.segment;
  if (cat.slug && CATEGORY_SEGMENT[cat.slug]) return CATEGORY_SEGMENT[cat.slug];
  return undefined;
}

export const DEFAULT_SEGMENT: SegmentKey = "beleza";

// ordem de exibicao no cadastro
export const SEGMENT_LIST: SegmentDef[] = [
  SEGMENTS.geral,
  SEGMENTS.beleza,
  SEGMENTS.saude,
];

export function isSegment(v: unknown): v is SegmentKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SEGMENTS, v);
}

export function segmentModules(segment?: string): ModuleKey[] {
  const key = isSegment(segment) ? segment : DEFAULT_SEGMENT;
  return SEGMENTS[key].modules;
}

export function modulesFor(segment?: string, categorySlug?: string): string[] {
  const base = segmentModules(segment) as string[];
  const extra = (categorySlug && CATEGORY_EXTRA_MODULES[categorySlug]) || [];
  return Array.from(new Set([...base, ...(extra as string[])]));
}

// aceita string do modulo; considera tambem os extras da categoria
export function hasModule(
  segment: string | undefined,
  mod: string,
  categorySlug?: string
): boolean {
  return modulesFor(segment, categorySlug).includes(mod);
}
