// Codigo de indicacao do afiliado (?ref=CODE) guardado no navegador ate o
// cadastro do indicado. Regras para NAO "grudar" em quem nao veio pelo link:
//  - vale por REF_DAYS dias a partir do clique no link;
//  - e apagado quando e usado (cadastro da conta/estabelecimento) e no logout
//    (outra pessoa no mesmo navegador nao herda a indicacao).
const KEY = "sp_ref";
const REF_DAYS = 30;

export function saveRef(code: string): void {
  const c = code.trim();
  if (!c) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ c, t: Date.now() }));
  } catch {
    // sem localStorage: ignora
  }
}

export function readRef(): string | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    let data: { c?: string; t?: number } | null = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    // formato antigo (so o codigo, sem data): descarta
    if (!data || typeof data !== "object" || !data.c || !data.t) {
      localStorage.removeItem(KEY);
      return undefined;
    }
    if (Date.now() - data.t > REF_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(KEY);
      return undefined;
    }
    return data.c;
  } catch {
    return undefined;
  }
}

export function clearRef(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

// captura o ?ref da URL atual (link do afiliado)
export function captureRefFromUrl(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) saveRef(ref);
  } catch {
    // ignora
  }
}
