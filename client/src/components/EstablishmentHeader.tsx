import { PhotoCarousel } from "./PhotoCarousel";

export function EstablishmentHeader({
  name,
  photo,
  coverPhotos,
  city,
  state,
  categoryName,
}: {
  name: string;
  photo?: string;
  coverPhotos?: string[];
  city?: string;
  state?: string;
  categoryName?: string;
}) {
  const covers = coverPhotos ?? [];

  return (
    <div>
      <PhotoCarousel
        photos={covers}
        heightClass="h-56 sm:h-72 md:h-80"
        autoPlay
      />

      <div className="relative -mt-10 px-4 sm:px-6">
        <div className="flex items-end gap-4">
          {photo ? (
            <img
              src={photo}
              alt={name}
              className="h-20 w-20 flex-shrink-0 rounded-2xl border-4 border-white object-cover shadow-sm sm:h-24 sm:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-teal-500/10 text-2xl font-bold text-teal-600 shadow-sm sm:h-24 sm:w-24">
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 pb-1">
            <h1 className="font-display truncate text-xl font-bold text-ink sm:text-2xl">
              {name}
            </h1>
            {(city || categoryName) && (
              <p className="truncate text-sm text-ink/60">
                {[categoryName, city && state ? `${city} - ${state}` : city]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}