import { useEffect, useRef, useState } from "react";
import { galleryApi, GalleryItem } from "../api/gallery";

const serviceTitle = (s: GalleryItem["service"]): string | null => {
  if (!s) return null;
  if (typeof s === "object" && "title" in s) return s.title;
  return null;
};

// Seção pública de antes/depois: carrossel horizontal + lightbox.
// Não renderiza nada se o estabelecimento não tiver itens.
export function GallerySection({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openItem, setOpenItem] = useState<GalleryItem | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    galleryApi
      .list(establishmentId) // só ativos (público)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  // fecha o lightbox com ESC
  useEffect(() => {
    if (!openItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openItem]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  // nada a mostrar: some da página
  if (loading || items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">
            Antes e depois
          </h2>
          <p className="text-sm text-ink/60">
            Alguns trabalhos realizados aqui.
          </p>
        </div>

        {/* setas só fazem sentido quando há mais de um */}
        {items.length > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => scrollBy(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
              aria-label="Anterior"
            >
              ←
            </button>
            <button
              onClick={() => scrollBy(1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
              aria-label="Próximo"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* carrossel */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
      >
        {items.map((item) => (
          <button
            key={item._id}
            onClick={() => setOpenItem(item)}
            className="group w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-ink/10 bg-white text-left transition hover:border-teal-500 hover:shadow-sm"
          >
            <div className="grid grid-cols-2">
              <div className="relative">
                <img
                  src={item.beforeUrl}
                  alt="Antes"
                  loading="lazy"
                  className="h-36 w-full object-cover"
                />
                <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-medium text-white">
                  Antes
                </span>
              </div>
              <div className="relative">
                <img
                  src={item.afterUrl}
                  alt="Depois"
                  loading="lazy"
                  className="h-36 w-full object-cover"
                />
                <span className="absolute left-2 top-2 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-medium text-white">
                  Depois
                </span>
              </div>
            </div>

            <div className="p-3">
              {item.title && (
                <h3 className="font-medium text-ink group-hover:text-teal-600">
                  {item.title}
                </h3>
              )}
              {(item.professionalName || serviceTitle(item.service)) && (
                <p className="mt-0.5 text-xs text-ink/50">
                  {item.professionalName}
                  {item.professionalName && serviceTitle(item.service)
                    ? " · "
                    : ""}
                  {serviceTitle(item.service)}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* lightbox */}
      {openItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
          onClick={() => setOpenItem(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 p-5">
              <div>
                <h3 className="font-display text-xl font-bold text-ink">
                  {openItem.title || "Antes e depois"}
                </h3>
                {(openItem.professionalName ||
                  serviceTitle(openItem.service)) && (
                  <p className="text-sm text-ink/60">
                    {openItem.professionalName}
                    {openItem.professionalName && serviceTitle(openItem.service)
                      ? " · "
                      : ""}
                    {serviceTitle(openItem.service)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpenItem(null)}
                className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <figure>
                <img
                  src={openItem.beforeUrl}
                  alt="Antes"
                  className="w-full rounded-xl object-contain"
                />
                <figcaption className="mt-2 text-center text-sm font-medium text-ink/60">
                  Antes
                </figcaption>
              </figure>
              <figure>
                <img
                  src={openItem.afterUrl}
                  alt="Depois"
                  className="w-full rounded-xl object-contain"
                />
                <figcaption className="mt-2 text-center text-sm font-medium text-teal-600">
                  Depois
                </figcaption>
              </figure>
            </div>

            {openItem.description && (
              <div className="px-5 pb-5">
                <p className="text-sm text-ink/70">{openItem.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}