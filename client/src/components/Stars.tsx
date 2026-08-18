// Exibicao da nota em estrelas. Preenche proporcionalmente a media
// (ex.: 4,8 -> 96% da largura preenchida), sobrepondo uma fileira dourada
// recortada sobre uma fileira cinza. So exibicao (nao clicavel).
export function Stars({
    value,
    count,
    size = "sm",
    showValue = true,
  }: {
    value: number;
    count?: number;
    size?: "sm" | "md" | "lg";
    showValue?: boolean;
  }) {
    const safe = Math.max(0, Math.min(5, value || 0));
    const pct = (safe / 5) * 100;
  
    const starClass =
      size === "lg" ? "text-xl" : size === "md" ? "text-base" : "text-sm";
    const numClass =
      size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";
  
    const label =
      count && count > 0
        ? `Nota ${safe.toFixed(1)} de 5, ${count} avaliacoes`
        : "Sem avaliacoes";
  
    return (
      <span className="inline-flex items-center gap-1.5" aria-label={label}>
        <span
          className={`relative inline-block leading-none ${starClass}`}
          aria-hidden="true"
        >
          <span className="text-ink/20">★★★★★</span>
          <span
            className="absolute inset-0 overflow-hidden whitespace-nowrap text-amber-400"
            style={{ width: `${pct}%` }}
          >
            ★★★★★
          </span>
        </span>
  
        {showValue && (
          <span className={`font-semibold text-ink/70 ${numClass}`}>
            {safe.toFixed(1).replace(".", ",")}
            {typeof count === "number" && count > 0 && (
              <span className="font-normal text-ink/40"> ({count})</span>
            )}
          </span>
        )}
      </span>
    );
  }