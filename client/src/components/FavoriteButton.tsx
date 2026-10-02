import { useState, MouseEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../lib/favorites";
import { AuthModal } from "./AuthModal";

// Coracao de favorito. "overlay" = bolinha sobre o card; "inline" = botao com
// texto (pagina do estabelecimento). Sem login, abre o modal de entrar e
// favorita logo depois.
export function FavoriteButton({
  establishmentId,
  variant = "overlay",
  onChange,
}: {
  establishmentId: string;
  variant?: "overlay" | "inline";
  onChange?: (favorite: boolean) => void;
}) {
  const { user } = useAuth();
  const { isFavorite, setFavorite } = useFavorites();
  const [authOpen, setAuthOpen] = useState(false);
  const fav = isFavorite(establishmentId);

  const toggle = async (e: MouseEvent) => {
    // o card inteiro e um <Link>: nao navega ao clicar no coracao
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const now = await setFavorite(establishmentId, !fav);
    onChange?.(now);
  };

  const label = fav ? "Remover dos favoritos" : "Adicionar aos favoritos";

  const heart = (
    <svg
      viewBox="0 0 24 24"
      className={variant === "overlay" ? "h-5 w-5" : "h-5 w-5 shrink-0"}
      fill={fav ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );

  return (
    <>
      {variant === "overlay" ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          aria-pressed={fav}
          title={label}
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-ink/10 transition hover:scale-110 ${
            fav ? "text-rose-500" : "text-ink/50 hover:text-rose-500"
          }`}
        >
          {heart}
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={fav}
          className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-5 font-semibold transition sm:w-auto ${
            fav
              ? "border-rose-500/40 bg-rose-500/10 text-rose-600"
              : "border-ink/15 bg-white text-ink/70 hover:border-rose-500/40 hover:text-rose-600"
          }`}
        >
          {heart}
          {fav ? "Favorito" : "Favoritar"}
        </button>
      )}

      {authOpen && (
        <AuthModal
          title="Entre para salvar favoritos"
          subtitle="Crie sua conta em segundos ou entre com a que já tem."
          onClose={() => setAuthOpen(false)}
          onSuccess={() => {
            setAuthOpen(false);
            void setFavorite(establishmentId, true).then((now) =>
              onChange?.(now)
            );
          }}
        />
      )}
    </>
  );
}
