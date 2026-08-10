// Avatar do usuario: mostra a foto quando existe, senao as iniciais do nome
// sobre um fundo colorido derivado do proprio nome (mesma pessoa -> mesma cor).

// paleta de fundos (tons que combinam com a identidade teal/amber do app)
const COLORS = [
    "bg-teal-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-orange-500",
    "bg-cyan-600",
    "bg-fuchsia-500",
  ];
  
  // escolhe uma cor estavel a partir do nome (hash simples)
  function colorFor(name: string): string {
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return COLORS[sum % COLORS.length];
  }
  
  // iniciais: primeira letra do primeiro e do ultimo nome (ate 2 letras)
  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  
  export function Avatar({
    name,
    src,
    size = 32,
    className = "",
  }: {
    name: string;
    src?: string | null;
    size?: number;
    className?: string;
  }) {
    const dimension = { width: size, height: size };
  
    if (src) {
      return (
        <img
          src={src}
          alt={name}
          style={dimension}
          className={`shrink-0 rounded-full object-cover ${className}`}
        />
      );
    }
  
    return (
      <span
        style={{ ...dimension, fontSize: size * 0.4 }}
        className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorFor(
          name
        )} ${className}`}
      >
        {initials(name)}
      </span>
    );
  }