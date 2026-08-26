// Base reduzida de CID-10 para autocomplete na evolucao. NAO e a tabela
// completa (a CID-10 tem ~14 mil codigos) — sao os mais usados em clinica,
// fisioterapia e odontologia. O usuario sempre pode digitar QUALQUER codigo
// manualmente (entrada livre), entao a lista nao precisa ser exaustiva.

export interface Cid10 {
  code: string;
  description: string;
}

export const CID10: Cid10[] = [
  // Infecciosas / gerais
  { code: "A09", description: "Diarreia e gastroenterite de origem infecciosa presumivel" },
  { code: "A90", description: "Dengue [dengue classico]" },
  { code: "B01", description: "Varicela [catapora]" },
  { code: "B02", description: "Herpes zoster" },
  { code: "B34.9", description: "Infeccao viral nao especificada" },
  // Endocrinas / metabolicas
  { code: "E03.9", description: "Hipotireoidismo nao especificado" },
  { code: "E10", description: "Diabetes mellitus insulino-dependente (tipo 1)" },
  { code: "E11", description: "Diabetes mellitus nao-insulino-dependente (tipo 2)" },
  { code: "E66", description: "Obesidade" },
  { code: "E78", description: "Disturbios do metabolismo de lipoproteinas (dislipidemia)" },
  // Mentais
  { code: "F32", description: "Episodios depressivos" },
  { code: "F33", description: "Transtorno depressivo recorrente" },
  { code: "F41.1", description: "Ansiedade generalizada" },
  { code: "F41.9", description: "Transtorno ansioso nao especificado" },
  { code: "F43.2", description: "Transtornos de adaptacao" },
  // Neurologicas
  { code: "G40", description: "Epilepsia" },
  { code: "G43", description: "Enxaqueca" },
  { code: "G44", description: "Outras sindromes de algias cefalicas" },
  { code: "G56", description: "Mononeuropatias dos membros superiores (ex.: tunel do carpo)" },
  // Olhos / ouvidos
  { code: "H10", description: "Conjuntivite" },
  { code: "H66", description: "Otite media supurativa e as nao especificadas" },
  // Circulatorias
  { code: "I10", description: "Hipertensao essencial (primaria)" },
  { code: "I20", description: "Angina pectoris" },
  { code: "I21", description: "Infarto agudo do miocardio" },
  { code: "I50", description: "Insuficiencia cardiaca" },
  { code: "I83", description: "Varizes dos membros inferiores" },
  // Respiratorias
  { code: "J00", description: "Nasofaringite aguda [resfriado comum]" },
  { code: "J02.9", description: "Faringite aguda nao especificada" },
  { code: "J03.9", description: "Amigdalite aguda nao especificada" },
  { code: "J06.9", description: "Infeccao aguda das vias aereas superiores nao especificada" },
  { code: "J11", description: "Influenza [gripe] devida a virus nao identificado" },
  { code: "J18.9", description: "Pneumonia nao especificada" },
  { code: "J20", description: "Bronquite aguda" },
  { code: "J30", description: "Rinite alergica e vasomotora" },
  { code: "J45", description: "Asma" },
  // Digestivas / odontologicas
  { code: "K02", description: "Carie dentaria" },
  { code: "K04", description: "Doencas da polpa e dos tecidos periapicais" },
  { code: "K05", description: "Gengivite e doencas periodontais" },
  { code: "K07", description: "Anomalias dentofaciais [inclusive maloclusao]" },
  { code: "K08", description: "Outros transtornos dos dentes e estruturas de sustentacao" },
  { code: "K21", description: "Doenca de refluxo gastroesofagico" },
  { code: "K29", description: "Gastrite e duodenite" },
  { code: "K30", description: "Dispepsia funcional" },
  { code: "K52.9", description: "Gastroenterite e colite nao-infecciosas nao especificadas" },
  { code: "K59.0", description: "Constipacao" },
  // Pele
  { code: "L20", description: "Dermatite atopica" },
  { code: "L23", description: "Dermatite alergica de contato" },
  { code: "L30.9", description: "Dermatite nao especificada" },
  { code: "L50", description: "Urticaria" },
  // Musculoesqueleticas (fisioterapia)
  { code: "M16", description: "Coxartrose [artrose do quadril]" },
  { code: "M17", description: "Gonartrose [artrose do joelho]" },
  { code: "M25.5", description: "Dor articular" },
  { code: "M51", description: "Outros transtornos de discos intervertebrais" },
  { code: "M53", description: "Outras dorsopatias nao classificadas em outra parte" },
  { code: "M54.2", description: "Cervicalgia" },
  { code: "M54.4", description: "Lumbago com ciatica" },
  { code: "M54.5", description: "Dor lombar baixa (lombalgia)" },
  { code: "M54.9", description: "Dorsalgia nao especificada" },
  { code: "M62.9", description: "Transtorno muscular nao especificado" },
  { code: "M65", description: "Sinovite e tenossinovite" },
  { code: "M70", description: "Transtornos dos tecidos moles relacionados com uso e pressao" },
  { code: "M75", description: "Lesoes do ombro" },
  { code: "M77", description: "Outras entesopatias (ex.: epicondilite)" },
  { code: "M79.7", description: "Fibromialgia" },
  // Geniturinarias
  { code: "N30", description: "Cistite" },
  { code: "N39.0", description: "Infeccao do trato urinario de localizacao nao especificada" },
  // Sintomas / sinais
  { code: "R05", description: "Tosse" },
  { code: "R10.4", description: "Outras dores abdominais e as nao especificadas" },
  { code: "R42", description: "Tontura e instabilidade" },
  { code: "R50.9", description: "Febre nao especificada" },
  { code: "R51", description: "Cefaleia" },
  // Traumas
  { code: "S83", description: "Luxacao, entorse e distensao das articulacoes do joelho" },
  { code: "S93", description: "Luxacao, entorse e distensao das articulacoes do tornozelo e do pe" },
  // Contato com servicos de saude
  { code: "Z00.0", description: "Exame medico geral" },
  { code: "Z23", description: "Necessidade de imunizacao" },
];

// remove acentos e baixa a caixa, para busca tolerante (\p{Diacritic} + flag u)
const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// busca por codigo (com ou sem ponto) ou por trecho da descricao
export function searchCid(query: string, limit = 8): Cid10[] {
  const q = norm(query.trim());
  if (!q) return [];
  const qCode = q.replace(/[^a-z0-9]/g, ""); // "m545" casa "M54.5"
  const out: Cid10[] = [];
  for (const c of CID10) {
    const codeNorm = norm(c.code).replace(/[^a-z0-9]/g, "");
    if (codeNorm.includes(qCode) || norm(c.description).includes(q)) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}
