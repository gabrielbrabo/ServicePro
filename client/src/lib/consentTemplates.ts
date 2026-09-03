// Modelos de termo de consentimento por PROCEDIMENTO (área Beleza/Estética).
// Usados na aba "Consentimento" da Ficha do cliente: escolher um modelo
// preenche tipo, título e texto — o profissional pode editar antes de salvar.
//
// IMPORTANTE: são MODELOS editáveis, um ponto de partida — não substituem
// orientação jurídica. Ajuste ao seu procedimento, produtos e realidade local.

export type ConsentKind = "procedimento" | "imagem" | "outro";

export interface ConsentTemplate {
  id: string;
  category: string;
  kind: ConsentKind;
  title: string;
  content: string;
}

// ordem das categorias no seletor (optgroups)
export const CONSENT_CATEGORIES = [
  "Estética facial",
  "Estética corporal",
  "Depilação",
  "Micropigmentação",
  "Cílios & sobrancelhas",
  "Tatuagem",
  "Bronzeamento",
  "Imagem",
  "Geral",
];

// bloco de fechamento padrão reutilizado nos termos de procedimento
const CLOSE =
  "Declaro que li e compreendi este termo, que tive a oportunidade de esclarecer todas as minhas dúvidas e que autorizo, de forma livre e esclarecida, a realização do procedimento. Estou ciente de que os resultados podem variar de pessoa para pessoa e de que poderá ser necessária mais de uma sessão.";

const HEALTH =
  "Informei ao profissional meu histórico de saúde, alergias, uso de medicamentos, gestação/amamentação e procedimentos anteriores, e recebi as orientações de cuidados antes e depois do procedimento.";

export const CONSENT_TEMPLATES: ConsentTemplate[] = [
  // ---------- Estética facial ----------
  {
    id: "limpeza_pele",
    category: "Estética facial",
    kind: "procedimento",
    title: "Consentimento — Limpeza de pele profunda",
    content:
      "Fui informado(a) sobre o procedimento de limpeza de pele profunda, que inclui higienização, esfoliação, extração de comedões e aplicação de ativos.\n\n" +
      "Riscos e reações possíveis: vermelhidão, ardência, edema, pequenas crostas e sensibilidade temporária; raramente hiperpigmentação ou reativação de herpes.\n\n" +
      HEALTH +
      "\n\nComprometo-me com os cuidados pós: fotoproteção diária, evitar exposição solar e não manipular a região.\n\n" +
      CLOSE,
  },
  {
    id: "peeling",
    category: "Estética facial",
    kind: "procedimento",
    title: "Consentimento — Peeling químico",
    content:
      "Fui informado(a) sobre o peeling químico, sua finalidade (renovação da pele, manchas, textura) e a técnica utilizada.\n\n" +
      "Riscos e reações possíveis: ardência, vermelhidão, descamação, escurecimento temporário, e — em casos raros — hiperpigmentação, hipopigmentação, cicatrizes ou infecção.\n\n" +
      HEALTH +
      "\n\nEstou ciente da necessidade de fotoproteção rigorosa e de evitar sol, calor intenso e outros ativos irritantes no período orientado.\n\n" +
      CLOSE,
  },
  {
    id: "microagulhamento",
    category: "Estética facial",
    kind: "procedimento",
    title: "Consentimento — Microagulhamento",
    content:
      "Fui informado(a) sobre o microagulhamento, que utiliza microagulhas para estimular a pele (indução percutânea de colágeno).\n\n" +
      "Riscos e reações possíveis: vermelhidão, edema, sensibilidade, pequenos sangramentos puntiformes e descamação; raramente infecção ou hiperpigmentação.\n\n" +
      "Confirmo o uso de material descartável/esterilizado e " +
      HEALTH.charAt(0).toLowerCase() +
      HEALTH.slice(1) +
      "\n\nComprometo-me com a fotoproteção e os cuidados pós repassados.\n\n" +
      CLOSE,
  },
  {
    id: "radiofrequencia",
    category: "Estética facial",
    kind: "procedimento",
    title: "Consentimento — Radiofrequência facial",
    content:
      "Fui informado(a) sobre a radiofrequência facial, sua finalidade (firmeza e estímulo de colágeno) e o uso de equipamento com aquecimento controlado.\n\n" +
      "Riscos e reações possíveis: vermelhidão e calor local temporários; raramente queimadura superficial.\n\n" +
      "Declaro não possuir contraindicações como marca-passo, próteses metálicas na área, gestação ou processos inflamatórios ativos, e " +
      HEALTH.charAt(0).toLowerCase() +
      HEALTH.slice(1) +
      "\n\n" +
      CLOSE,
  },
  {
    id: "toxina",
    category: "Estética facial",
    kind: "procedimento",
    title: "Consentimento — Toxina botulínica",
    content:
      "Fui informado(a) sobre a aplicação de toxina botulínica, sua finalidade, a técnica e o caráter temporário do efeito.\n\n" +
      "Riscos e reações possíveis: dor, edema e hematoma no local; assimetria, ptose (queda) temporária, cefaleia; raramente reações alérgicas.\n\n" +
      HEALTH +
      "\n\nEstou ciente das contraindicações (gestação/amamentação, doenças neuromusculares, alergia ao produto) e das orientações pós-aplicação.\n\n" +
      CLOSE,
  },
  {
    id: "preenchimento",
    category: "Estética facial",
    kind: "procedimento",
    title: "Consentimento — Preenchimento com ácido hialurônico",
    content:
      "Fui informado(a) sobre o preenchimento com ácido hialurônico, sua finalidade, a técnica e a durabilidade variável do resultado.\n\n" +
      "Riscos e reações possíveis: dor, edema, hematoma, nódulos e assimetria; raramente reação alérgica, infecção ou comprometimento vascular.\n\n" +
      HEALTH +
      "\n\nEstou ciente das contraindicações e das orientações de cuidados, e de que retoques podem ser necessários.\n\n" +
      CLOSE,
  },

  // ---------- Estética corporal ----------
  {
    id: "corporal_aparelhos",
    category: "Estética corporal",
    kind: "procedimento",
    title: "Consentimento — Procedimento corporal com aparelhos",
    content:
      "Fui informado(a) sobre o procedimento corporal (ex.: radiofrequência, ultracavitação, corrente russa, endermologia) e sua finalidade estética.\n\n" +
      "Riscos e reações possíveis: vermelhidão, calor, sensibilidade e hematomas leves temporários.\n\n" +
      "Declaro não possuir contraindicações (gestação, marca-passo, próteses/metais na área, trombose, câncer em atividade) e " +
      HEALTH.charAt(0).toLowerCase() +
      HEALTH.slice(1) +
      "\n\n" +
      CLOSE,
  },
  {
    id: "drenagem_massagem",
    category: "Estética corporal",
    kind: "procedimento",
    title: "Consentimento — Massagem / drenagem linfática",
    content:
      "Fui informado(a) sobre a massagem modeladora / drenagem linfática, sua finalidade e a técnica manual utilizada.\n\n" +
      "Riscos e reações possíveis: sensibilidade e hematomas leves temporários.\n\n" +
      "Declaro não possuir contraindicações (trombose, infecções, gestação de risco, câncer em atividade sem liberação médica) e " +
      HEALTH.charAt(0).toLowerCase() +
      HEALTH.slice(1) +
      "\n\n" +
      CLOSE,
  },

  // ---------- Depilação ----------
  {
    id: "laser",
    category: "Depilação",
    kind: "procedimento",
    title: "Consentimento — Depilação a laser / luz intensa pulsada",
    content:
      "Fui informado(a) sobre a depilação a laser / luz intensa pulsada, sua finalidade e a necessidade de várias sessões.\n\n" +
      "Riscos e reações possíveis: vermelhidão, edema perifolicular, ardência; raramente queimadura, bolhas, alteração da cor da pele (hiper/hipopigmentação) ou foliculite.\n\n" +
      HEALTH +
      "\n\nEstou ciente de que devo evitar exposição solar e bronzeamento antes e depois, usar fotoproteção e informar uso de fotossensibilizantes.\n\n" +
      CLOSE,
  },
  {
    id: "cera",
    category: "Depilação",
    kind: "procedimento",
    title: "Consentimento — Depilação com cera",
    content:
      "Fui informado(a) sobre a depilação com cera e a técnica utilizada.\n\n" +
      "Riscos e reações possíveis: vermelhidão, sensibilidade, pequenos sangramentos puntiformes, foliculite e, em peles sensíveis, irritação.\n\n" +
      "Confirmo o uso de material higienizado e sem reaproveitamento indevido, e " +
      HEALTH.charAt(0).toLowerCase() +
      HEALTH.slice(1) +
      "\n\n" +
      CLOSE,
  },

  // ---------- Micropigmentação ----------
  {
    id: "micro_sobrancelha",
    category: "Micropigmentação",
    kind: "procedimento",
    title: "Consentimento — Micropigmentação de sobrancelhas",
    content:
      "Fui informado(a) sobre a micropigmentação de sobrancelhas, técnica de implantação de pigmento na pele, seu caráter semipermanente e a necessidade de retoque.\n\n" +
      "Riscos e reações possíveis: vermelhidão, edema, crostas, clareamento/alteração da cor com o tempo; raramente reação alérgica ao pigmento ou infecção.\n\n" +
      "Confirmo o uso de material descartável e esterilizado. Concordei previamente com o desenho, a cor e o formato. " +
      HEALTH +
      "\n\n" +
      CLOSE,
  },
  {
    id: "micro_labial",
    category: "Micropigmentação",
    kind: "procedimento",
    title: "Consentimento — Micropigmentação labial",
    content:
      "Fui informado(a) sobre a micropigmentação labial, seu caráter semipermanente e a necessidade de retoque.\n\n" +
      "Riscos e reações possíveis: edema, crostas, alteração de cor e possibilidade de reativação de herpes labial (podendo ser indicada profilaxia).\n\n" +
      "Confirmo o uso de material descartável e esterilizado e concordei com a cor e o contorno. " +
      HEALTH +
      "\n\n" +
      CLOSE,
  },

  // ---------- Cílios & sobrancelhas ----------
  {
    id: "cilios",
    category: "Cílios & sobrancelhas",
    kind: "procedimento",
    title: "Consentimento — Extensão de cílios",
    content:
      "Fui informado(a) sobre a aplicação de extensão de cílios (fio a fio/volume) e o uso de adesivo específico.\n\n" +
      "Riscos e reações possíveis: irritação, ardência, vermelhidão ou reação alérgica ao adesivo; desconforto se houver contato com os olhos.\n\n" +
      "Declaro não ter alergia conhecida aos produtos e infecção ocular ativa, e recebi as orientações de manutenção e higienização.\n\n" +
      CLOSE,
  },
  {
    id: "lash_brow",
    category: "Cílios & sobrancelhas",
    kind: "procedimento",
    title: "Consentimento — Lash lifting / Brow lamination / Henna",
    content:
      "Fui informado(a) sobre o procedimento (lash lifting, brow lamination ou coloração/henna) e os produtos utilizados.\n\n" +
      "Riscos e reações possíveis: irritação, ardência, vermelhidão e reação alérgica; recomenda-se teste de sensibilidade prévio.\n\n" +
      "Declaro não ter alergia conhecida aos produtos nem processo inflamatório ativo na região, e recebi as orientações de cuidados.\n\n" +
      CLOSE,
  },

  // ---------- Tatuagem ----------
  {
    id: "tatuagem",
    category: "Tatuagem",
    kind: "procedimento",
    title: "Consentimento — Tatuagem",
    content:
      "Fui informado(a) sobre o procedimento de tatuagem, seu caráter PERMANENTE e a dificuldade/limitação de remoção posterior.\n\n" +
      "Riscos e reações possíveis: dor, edema, vermelhidão, crostas; raramente reação alérgica à tinta, infecção ou cicatriz. Confirmo o uso de material descartável e esterilizado e de tintas adequadas.\n\n" +
      "Declaro ser maior de idade, não estar sob efeito de álcool/substâncias, e ter aprovado previamente o desenho, o tamanho e a localização. " +
      HEALTH +
      "\n\n" +
      CLOSE,
  },

  // ---------- Bronzeamento ----------
  {
    id: "bronze",
    category: "Bronzeamento",
    kind: "procedimento",
    title: "Consentimento — Bronzeamento artificial",
    content:
      "Fui informado(a) sobre o bronzeamento artificial (jato/natural com ativos) e sua finalidade estética.\n\n" +
      "Riscos e reações possíveis: manchas, irregularidade da cor, ressecamento e reação alérgica aos produtos.\n\n" +
      "Declaro não ter alergia conhecida aos ativos e recebi as orientações de preparação da pele e de cuidados pós.\n\n" +
      CLOSE,
  },

  // ---------- Imagem ----------
  {
    id: "imagem",
    category: "Imagem",
    kind: "imagem",
    title: "Autorização de uso de imagem",
    content:
      "Autorizo o estabelecimento a fotografar e/ou filmar o resultado do meu atendimento e a utilizar essas imagens para fins de portfólio e divulgação (redes sociais, site e materiais de marketing), sem finalidade comercial de venda das imagens a terceiros.\n\n" +
      "Esta autorização é concedida de forma gratuita e por prazo indeterminado, podendo ser revogada por escrito a qualquer momento, sem efeito retroativo sobre materiais já publicados.\n\n" +
      "Estou ciente do tratamento dos meus dados conforme a LGPD (Lei nº 13.709/2018) para as finalidades aqui descritas.",
  },
  {
    id: "imagem_antesdepois",
    category: "Imagem",
    kind: "imagem",
    title: "Autorização de uso de imagem — antes e depois",
    content:
      "Autorizo o registro e a utilização de fotos de ANTES e DEPOIS do meu procedimento para fins de acompanhamento clínico e divulgação do trabalho do profissional/estabelecimento.\n\n" +
      "Poderei solicitar a não divulgação pública das imagens mantendo o registro apenas no meu prontuário/ficha. Autorização gratuita, por prazo indeterminado e revogável por escrito.\n\n" +
      "Estou ciente do tratamento dos meus dados conforme a LGPD (Lei nº 13.709/2018).",
  },

  // ---------- Geral ----------
  {
    id: "geral",
    category: "Geral",
    kind: "procedimento",
    title: "Termo geral de consentimento de procedimento",
    content:
      "Declaro que fui informado(a) sobre o procedimento a ser realizado, sua finalidade, a técnica utilizada, os resultados esperados e as alternativas, de forma clara e em linguagem acessível.\n\n" +
      "Estou ciente de que todo procedimento estético envolve riscos e de que os resultados variam conforme características individuais.\n\n" +
      HEALTH +
      "\n\n" +
      CLOSE,
  },
];
