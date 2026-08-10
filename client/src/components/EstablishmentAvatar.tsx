// Foto de perfil do estabelecimento no MESMO estilo do EstablishmentProfileHeader:
// quadrado de cantos arredondados; sem foto, cai no bloco com gradiente teal e a
// inicial do nome. Mantem a identidade visual consistente entre o header e o card.

export function EstablishmentAvatar({
    name,
    src,
    size = 48,
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
          className={`shrink-0 rounded-lg object-cover ${className}`}
        />
      );
    }
  
    return (
      <span
        style={{ ...dimension, fontSize: size * 0.42 }}
        className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 font-bold text-white ${className}`}
      >
        {(name.charAt(0) || "?").toUpperCase()}
      </span>
    );
  }