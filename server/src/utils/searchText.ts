// utils/searchText.ts
// Helpers para buscas textuais tolerantes na digitacao do cliente.
//
// Problema que resolve: o texto cru do cliente ia direto para { $regex },
// entao caracteres como ^ ~ * + ? ( ) [ ] { } | $ \ eram interpretados como
// regex e podiam quebrar a busca, dar erro ou virar regex perigosa (ReDoS).
// Alem disso, espacos nas pontas faziam a busca nao casar.
//
// Este helper: tira acentos, remove espacos das pontas, colapsa espacos
// internos, remove simbolos de regex indesejados e escapa o que sobra.

// escapa os metacaracteres de regex que restarem no termo
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  
  // grupos de letras <-> variantes acentuadas (pt-BR): cada letra base passa a
  // casar tambem suas versoes com acento nos dados do banco.
  const ACCENT_GROUPS: Record<string, string> = {
    a: "aàáâãä",
    e: "eèéêë",
    i: "iìíîï",
    o: "oòóôõö",
    u: "uùúûü",
    c: "cç",
    n: "nñ",
  };
  
  // Recebe o texto cru do cliente e devolve um PADRAO de regex (string) pronto
  // para usar em { $regex: pattern, $options: "i" }, ou null quando nao ha termo
  // util (vazio, so espacos ou so simbolos).
  export function buildSearchRegex(raw: unknown): string | null {
    if (raw === undefined || raw === null) return null;
  
    const cleaned = String(raw)
      // 1) separa os acentos das letras e remove os acentos
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // 2) troca simbolos indesejados (^ ~ * ( ) [ ] etc) por espaco,
      //    mantendo letras, numeros, espaco e alguns sinais comuns de nome
      //    (& . ' -). Trocar por espaco evita colar palavras: "casa^bela".
      .replace(/[^\p{L}\p{N}\s&.'-]/gu, " ")
      // 3) remove espacos das pontas
      .trim()
      // 4) colapsa espacos repetidos no meio
      .replace(/\s+/g, " ");
  
    if (!cleaned) return null;
  
    // 5) escapa o que sobrou (ex.: . - ficam literais)
    const escaped = escapeRegex(cleaned);
  
    // 6) cada letra base casa suas variantes acentuadas; cada espaco tolera
    //    um ou mais espacos nos dados
    const pattern = escaped
      .replace(/[a-z]/gi, (ch) => {
        const group = ACCENT_GROUPS[ch.toLowerCase()];
        return group ? `[${group}]` : ch;
      })
      .replace(/ /g, "\\s+");
  
    return pattern;
  }