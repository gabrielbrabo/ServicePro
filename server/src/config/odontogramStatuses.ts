// Lista-padrao de status do odontograma. Cada clinica pode personalizar a
// sua propria lista (salva em OdontogramSettings); quando nao personalizou,
// vale esta aqui. "higido" e o status neutro (dente sem marca) e e sempre
// obrigatorio/reservado.

export interface ToothStatusDef {
    key: string; // identificador estavel (fica gravado no dente)
    label: string;
    color: string; // hex (#rrggbb)
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
  
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  
  // valida e normaliza uma lista vinda do cliente. Garante o status neutro
  // "higido" sempre presente e como primeiro item, chaves unicas e cores hex.
  export function sanitizeStatuses(input: unknown): ToothStatusDef[] {
    const arr = Array.isArray(input) ? input : [];
    const out: ToothStatusDef[] = [];
    const seen = new Set<string>();
  
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const key = String((raw as any).key || "").trim();
      const label = String((raw as any).label || "").trim();
      let color = String((raw as any).color || "").trim();
  
      if (!KEY.test(key)) continue;
      if (!label) continue;
      if (!HEX.test(color)) color = key === NEUTRAL_STATUS ? "#ffffff" : "#94a3b8";
      if (seen.has(key)) continue;
  
      seen.add(key);
      out.push({ key, label, color: color.toLowerCase() });
    }
  
    // neutro sempre presente e no topo
    const neutral = out.find((s) => s.key === NEUTRAL_STATUS);
    const rest = out.filter((s) => s.key !== NEUTRAL_STATUS);
    const head = neutral || DEFAULT_TOOTH_STATUSES[0];
  
    return [head, ...rest];
  }