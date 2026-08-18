import { useEffect, useState, useCallback, useRef } from "react";
import { establishmentPhotoApi } from "../api/establishmentPhoto";
import { uploadImage, deleteUploadByUrl } from "../api/upload";
import { PhotoCarousel } from "./PhotoCarousel";
import { Stars } from "./Stars";

const MAX_COVERS = 6;

export function EstablishmentProfileHeader({
  establishmentId,
  name,
  categoryIcon,
  categoryName,
  city,
  state,
  addressLine,
  description,
  initialPhoto,
  initialCovers,
  ratingAvg,
  ratingCount,
  editable = false,
  children,
  coverOverlay,
}: {
  establishmentId: string;
  name: string;
  categoryIcon?: string;
  categoryName?: string;
  city?: string;
  state?: string;
  addressLine?: string; // endereco completo (linha separada)
  description?: string;
  initialPhoto?: string;
  initialCovers?: string[];
  ratingAvg?: number; // nota agregada (sistema de avaliacao)
  ratingCount?: number;
  editable?: boolean;
  children?: React.ReactNode;
  coverOverlay?: React.ReactNode; // conteudo sobreposto no topo da capa (ex: titulo + botao do dashboard)
}) {
  const [photo, setPhoto] = useState(initialPhoto ?? "");
  const [covers, setCovers] = useState<string[]>(initialCovers ?? []);
  const [loading, setLoading] = useState(!initialCovers);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCovers, setUploadingCovers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // se o pai nao passou as fotos, busca no backend
  const load = useCallback(() => {
    if (initialCovers) return;
    setLoading(true);
    establishmentPhotoApi
      .get(establishmentId)
      .then((d) => {
        setPhoto(d.photo || "");
        setCovers(d.coverPhotos || []);
      })
      .catch(() => setError("Não foi possível carregar as fotos."))
      .finally(() => setLoading(false));
  }, [establishmentId, initialCovers]);

  useEffect(load, [load]);

  const validate = (files: File[]): boolean => {
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        setError("Escolha apenas arquivos de imagem.");
        return false;
      }
      if (f.size > 5 * 1024 * 1024) {
        setError(`"${f.name}" é maior que 5 MB.`);
        return false;
      }
    }
    return true;
  };

  // ---- foto de perfil ----
  const handlePhotoFile = async (file: File) => {
    if (!validate([file])) return;

    setUploadingCovers(false);
    setUploadingPhoto(true);
    setError(null);
    const previous = photo;
    try {
      const { url } = await uploadImage(file, "estabelecimentos");
      setPhoto(url);
      await establishmentPhotoApi.updateProfile(establishmentId, url);
      if (previous) void deleteUploadByUrl(previous);
    } catch {
      setPhoto(previous);
      setError("Não foi possível salvar a foto de perfil.");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    const previous = photo;
    setPhoto("");
    setError(null);
    try {
      await establishmentPhotoApi.updateProfile(establishmentId, "");
      // so apaga do S3 depois que o Mongo confirmou
      void deleteUploadByUrl(previous);
    } catch {
      setPhoto(previous);
      setError("Não foi possível remover a foto de perfil.");
    }
  };

  // ---- capas ----
  const persistCovers = async (list: string[]) => {
    const previous = covers;
    setCovers(list);
    setError(null);
    try {
      const res = await establishmentPhotoApi.updateCovers(
        establishmentId,
        list
      );
      setCovers(res.coverPhotos);
    } catch {
      setCovers(previous);
      setError("Não foi possível salvar as fotos de capa.");
    }
  };

  const handleCoverFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const free = MAX_COVERS - covers.length;
    if (free <= 0) {
      setError(`Limite de ${MAX_COVERS} fotos de capa atingido.`);
      return;
    }

    const selected = files.slice(0, free);
    if (!validate(selected)) return;

    setUploadingCovers(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const f of selected) {
        const { url } = await uploadImage(f, "estabelecimentos");
        urls.push(url);
      }
      await persistCovers([...covers, ...urls]);
      if (files.length > selected.length) {
        setError(
          `${files.length - selected.length} foto(s) ignorada(s) pelo limite de ${MAX_COVERS}.`
        );
      }
    } catch {
      setError("Não foi possível enviar as imagens.");
    } finally {
      setUploadingCovers(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const removeCover = async (url: string) => {
    const previous = covers;
    const list = covers.filter((c) => c !== url);
    setCovers(list);
    setError(null);
    try {
      const res = await establishmentPhotoApi.updateCovers(
        establishmentId,
        list
      );
      setCovers(res.coverPhotos);
      // so apaga do S3 depois que o Mongo confirmou
      void deleteUploadByUrl(url);
    } catch {
      setCovers(previous);
      setError("Não foi possível remover a foto.");
    }
  };

  const moveCover = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= covers.length) return;
    const list = [...covers];
    [list[from], list[to]] = [list[to], list[from]];
    void persistCovers(list);
  };

  const hasCovers = covers.length > 0;
  const location = city && state ? `${city} - ${state}` : city;

  // full-bleed: ignora o max-w-5xl e o px-4 do PageContainer, encostando nas
  // bordas da viewport. O -mt-8 cancela o py-8 do container so na capa.
  const fullBleed =
    "relative left-1/2 right-1/2 -mx-[50vw] w-screen -mt-8";

  return (
    <div>
      {/* ---- Capa (full-bleed, colada no topo) ---- */}
      <div className={`${fullBleed} relative`}>
        {hasCovers ? (
          <>
            <PhotoCarousel
              photos={covers}
              heightClass="h-56 sm:h-80 md:h-96 lg:h-[28rem]"
              rounded="rounded-none"
              autoPlay
            />
            {/* gradiente inferior: profundidade + leitura do avatar sobreposto */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/30 to-transparent" />
          </>
        ) : editable ? (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCovers || loading}
            className="flex h-52 w-full flex-col items-center justify-center gap-1.5 bg-sand/60 text-ink/50 transition hover:bg-sand disabled:opacity-60 sm:h-64"
          >
            <span className="text-4xl">🖼</span>
            <span className="text-sm font-semibold">
              {uploadingCovers
                ? "Enviando..."
                : "Adicionar fotos de capa (até 6)"}
            </span>
            <span className="text-xs text-ink/40">
              Horizontais ficam melhores · JPG, PNG ou WEBP, até 5 MB
            </span>
          </button>
        ) : (
          <div className="h-44 w-full bg-gradient-to-br from-teal-600 to-teal-800 sm:h-56" />
        )}

        {/* botao de gerenciar capa (dono, quando ja existem fotos) */}
        {editable && hasCovers && (
          <button
            type="button"
            onClick={() => setManaging((m) => !m)}
            className="absolute right-4 top-4 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-white"
          >
            {managing ? "Concluir" : "Editar capa"}
          </button>
        )}

        {/* slot sobreposto no topo da capa (titulo + acoes do dashboard) */}
        {coverOverlay && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4 sm:p-6">
            <div className="pointer-events-auto">{coverOverlay}</div>
          </div>
        )}
      </div>

      {/* ---- Identidade (dentro do container, avatar sobe sobre a capa) ---- */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          {/* Avatar na frente do nome — grande e sobreposto */}
          <div className="relative flex-shrink-0">
            {photo ? (
              <img
                src={photo}
                alt={name}
                className="h-28 w-28 -mt-16 rounded-3xl border-4 border-white bg-white object-cover shadow-lg sm:h-36 sm:w-36 sm:-mt-24"
              />
            ) : editable ? (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="flex h-28 w-28 -mt-16 flex-col items-center justify-center rounded-3xl border-4 border-white bg-sand text-ink/40 shadow-lg transition hover:text-teal-600 disabled:opacity-60 sm:h-36 sm:w-36 sm:-mt-24"
              >
                <span className="text-2xl leading-none">
                  {uploadingPhoto ? "···" : "+"}
                </span>
                <span className="mt-1 px-1 text-[11px] font-medium leading-tight">
                  {uploadingPhoto ? "Enviando" : "Adicionar foto"}
                </span>
              </button>
            ) : (
              <div className="flex h-28 w-28 -mt-16 items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-br from-teal-400 to-teal-600 text-4xl font-bold text-white shadow-lg sm:h-36 sm:w-36 sm:-mt-24">
                {name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* trocar/remover foto de perfil (dono) */}
            {editable && photo && (
              <div className="mt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="text-[11px] font-medium text-ink/50 transition hover:text-teal-600 disabled:opacity-60"
                >
                  {uploadingPhoto ? "Enviando..." : "Trocar"}
                </button>
                <button
                  type="button"
                  onClick={() => void removePhoto()}
                  disabled={uploadingPhoto}
                  className="text-[11px] font-medium text-red-500 transition hover:underline disabled:opacity-60"
                >
                  Remover
                </button>
              </div>
            )}
          </div>

          {/* Nome, categoria, localização */}
          <div className="min-w-0 pt-1 sm:pb-1">
            <h1 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {categoryName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-3 py-1 text-sm font-medium text-teal-600">
                  {categoryIcon} {categoryName}
                </span>
              )}
              {location && (
                <span className="inline-flex items-center gap-1 text-sm text-ink/60">
                  <svg
                    className="h-4 w-4 text-ink/40"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.69 18.933c.3.146.66.146.96 0C13.94 17.5 17 13.87 17 8A7 7 0 103 8c0 5.87 3.06 9.5 6.69 10.933zM10 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {location}
                </span>
              )}
            </div>

            {addressLine && (
              <p className="mt-1.5 text-sm text-ink/50">{addressLine}</p>
            )}

            {/* nota em estrelas (sistema de avaliacao) */}
            <div className="mt-2">
              {ratingCount && ratingCount > 0 ? (
                <Stars value={ratingAvg ?? 0} count={ratingCount} size="md" />
              ) : (
                <span className="text-sm text-ink/40">
                  Ainda sem avaliações
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ações (ex: Agendar) */}
        {children && <div className="flex-shrink-0 sm:pb-1">{children}</div>}
      </div>

      {description && (
        <p className="mt-5 max-w-2xl leading-relaxed text-ink/70">
          {description}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {/* ---- Gerenciador de capas (dono, ao clicar em "Editar capa") ---- */}
      {editable && managing && (
        <div className="mt-5 rounded-2xl bg-sand/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink/70">
              Fotos de capa
            </span>
            <span className="text-xs font-medium text-ink/40">
              {covers.length} / {MAX_COVERS}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {covers.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-ink/10 bg-white"
              >
                <img
                  src={url}
                  alt={`Capa ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Principal
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/50 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveCover(i, -1)}
                    disabled={i === 0}
                    aria-label="Mover para trás"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink transition hover:bg-white disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCover(url)}
                    aria-label="Remover foto"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-sm text-white transition hover:bg-red-600"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCover(i, 1)}
                    disabled={i === covers.length - 1}
                    aria-label="Mover para frente"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink transition hover:bg-white disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
              </div>
            ))}

            {covers.length < MAX_COVERS && (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCovers}
                className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-ink/20 text-sm font-medium text-ink/50 transition hover:border-teal-500 hover:text-teal-600 disabled:opacity-60"
              >
                <span className="text-xl leading-none">+</span>
                <span className="mt-1 text-xs">
                  {uploadingCovers ? "Enviando..." : "Adicionar"}
                </span>
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-ink/40">
            A primeira foto é a principal. Passe o mouse sobre uma foto para
            reordenar ou remover.
          </p>
        </div>
      )}

      {/* inputs escondidos */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handlePhotoFile(f);
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleCoverFiles(e.target.files);
        }}
      />
    </div>
  );
}