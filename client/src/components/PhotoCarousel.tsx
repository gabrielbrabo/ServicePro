import { useState, useEffect, useCallback, useRef } from "react";

export function PhotoCarousel({
  photos,
  heightClass = "h-56 sm:h-72 md:h-80",
  autoPlay = false,
  intervalMs = 5000,
  rounded = "rounded-2xl",
}: {
  photos: string[];
  heightClass?: string;
  autoPlay?: boolean;
  intervalMs?: number;
  rounded?: string;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const total = photos.length;

  const next = useCallback(() => {
    setIndex((i) => (total ? (i + 1) % total : 0));
  }, [total]);

  const prev = useCallback(() => {
    setIndex((i) => (total ? (i - 1 + total) % total : 0));
  }, [total]);

  // se a lista encolher (foto removida), nao deixa o indice estourar
  useEffect(() => {
    setIndex((i) => (total === 0 ? 0 : Math.min(i, total - 1)));
  }, [total]);

  useEffect(() => {
    if (!autoPlay || total <= 1) return;
    const t = setInterval(next, intervalMs);
    return () => clearInterval(t);
  }, [autoPlay, intervalMs, next, total]);

  if (total === 0) {
    return (
      <div
        className={`flex ${heightClass} w-full flex-col items-center justify-center ${rounded} border border-dashed border-ink/20 bg-sand/40 text-ink/40`}
      >
        <span className="text-3xl">🖼</span>
        <span className="mt-2 text-sm">Nenhuma foto de capa</span>
      </div>
    );
  }

  return (
    <div
      className={`group relative w-full overflow-hidden ${heightClass} ${rounded} bg-ink/5`}
      onTouchStart={(e) => {
        touchStartX.current = e.targetTouches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) next();
          else prev();
        }
        touchStartX.current = null;
      }}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {photos.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={`Foto ${i + 1}`}
            loading={i === 0 ? "eager" : "lazy"}
            className="h-full w-full flex-shrink-0 object-cover"
          />
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Foto anterior"
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow-sm backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Próxima foto"
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow-sm backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
          >
            ›
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir para a foto ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}