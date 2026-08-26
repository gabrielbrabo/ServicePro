// Espelho do padrao do backend (server/src/config/odontogramStatuses.ts).
// Usado como fallback e como base ao personalizar. "higido" e o status neutro.

export interface ToothStatusDef {
    key: string;
    label: string;
    color: string; // hex #rrggbb
  }
  
  export const NEUTRAL_STATUS = "higido";
  
  export const DEFAULT_TOOTH_STATUSES: ToothStatusDef[] = [
    { key: "higido", label: "Hígido", color: "#ffffff" },
    { key: "carie", label: "Cárie", color: "#f87171" },
    { key: "restaurado", label: "Restaurado", color: "#60a5fa" },
    { key: "canal", label: "Canal", color: "#c084fc" },
    { key: "coroa", label: "Coroa/prótese", color: "#fbbf24" },
    { key: "implante", label: "Implante", color: "#2dd4bf" },
    { key: "ausente", label: "Ausente", color: "#9ca3af" },
    { key: "extrair", label: "Extração", color: "#fb923c" },
    { key: "selante", label: "Selante", color: "#34d399" },
    { key: "fratura", label: "Fratura", color: "#fb7185" },
    { key: "ponte", label: "Ponte/pôntico", color: "#818cf8" },
    { key: "nucleo", label: "Núcleo/pino", color: "#22d3ee" },
    { key: "faceta", label: "Faceta", color: "#f472b6" },
    { key: "provisorio", label: "Provisório", color: "#facc15" },
    { key: "incluso", label: "Incluso/impactado", color: "#a78bfa" },
    { key: "agenesia", label: "Agenesia", color: "#cbd5e1" },
    { key: "mobilidade", label: "Mobilidade", color: "#e879f9" },
    { key: "deciduo", label: "Decíduo/a erupcionar", color: "#38bdf8" },
  ];
  
  // gera uma chave estavel a partir do rotulo, garantindo unicidade na lista.
  export function slugifyKey(label: string, taken: Set<string>): string {
    let base = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!base) base = "status";
    let key = base;
    let i = 2;
    while (taken.has(key)) key = `${base}-${i++}`;
    return key;
  }
  
  // hex (#rrggbb) -> rgba(r,g,b,a) para tints/bordas inline.
  export function hexToRgba(hex: string, alpha: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return `rgba(148,163,184,${alpha})`;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  
  // cor de texto legivel sobre um tint claro: escurece o proprio hex.
  export function darken(hex: string, factor = 0.55): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return "#334155";
    const n = parseInt(m[1], 16);
    const r = Math.round(((n >> 16) & 255) * factor);
    const g = Math.round(((n >> 8) & 255) * factor);
    const b = Math.round((n & 255) * factor);
    return `rgb(${r},${g},${b})`;
  }
  
  // e "branco/neutro"? (dente sem cor real)
  export function isWhite(hex: string): boolean {
    return /^#?f{6}$/i.test(hex.trim());
  }