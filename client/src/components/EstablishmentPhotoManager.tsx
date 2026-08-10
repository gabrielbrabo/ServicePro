import { useEffect, useState, useCallback, useRef } from "react";
import { establishmentPhotoApi } from "../api/establishmentPhoto";
import { uploadImage } from "../api/upload";
import { ImageUpload } from "./ImageUpload";
import { PhotoCarousel } from "./PhotoCarousel";

const MAX_COVERS = 6;

export function EstablishmentPhotoManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [photo, setPhoto] = useState("");
  const [covers, setCovers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const flashOk = (msg: string) => {
    setOk(msg);
    setError(null);
    setTimeout(() => setOk(null), 3000);
  };

  const load = useCallback(() => {
    setLoading(true);
    establishmentPhotoApi
      .get(establishmentId)
      .then((d) => {
        setPhoto(d.photo || "");
        setCovers(d.coverPhotos || []);
      })
      .catch(() => setError("Não foi possível carregar as fotos."))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  useEffect(load, [load]);

  // foto de perfil: o ImageUpload ja subiu para o S3 e devolveu a URL
  const handleProfileChange = async (url: string) => {
    const previous = photo;
    setPhoto(url); // otimista
    setError(null);
    try {
      await establishmentPhotoApi.updateProfile(establishmentId, url);
      flashOk(url ? "Foto de perfil atualizada." : "Foto de perfil removida.");
    } catch {
      setPhoto(previous);
      setError("Não foi possível salvar a foto de perfil.");
    }
  };

  // salva a lista de capas no backend, com rollback em caso de erro
  const persistCovers = async (list: string[], msg: string) => {
    const previous = covers;
    setCovers(list); // otimista
    setError(null);
    try {
      const res = await establishmentPhotoApi.updateCovers(
        establishmentId,
        list
      );
      setCovers(res.coverPhotos);
      flashOk(msg);
    } catch {
      setCovers(previous);
      setError("Não foi possível salvar as fotos de capa.");
    }
  };

  const handleFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const free = MAX_COVERS - covers.length;
    if (free <= 0) {
      setError(`Você já atingiu o limite de ${MAX_COVERS} fotos de capa.`);
      return;
    }

    const selected = files.slice(0, free);

    for (const f of selected) {
      if (!f.type.startsWith("image/")) {
        setError("Escolha apenas arquivos de imagem.");
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setError(`"${f.name}" é maior que 5 MB.`);
        return;
      }
    }

    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const f of selected) {
        const { url } = await uploadImage(f, "estabelecimentos");
        urls.push(url);
      }

      const ignored = files.length - selected.length;
      await persistCovers(
        [...covers, ...urls],
        ignored > 0
          ? `${urls.length} foto(s) adicionada(s). ${ignored} ignorada(s) pelo limite de ${MAX_COVERS}.`
          : `${urls.length} foto(s) adicionada(s).`
      );
    } catch {
      setError("Não foi possível enviar as imagens. Tente novamente.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeCover = (url: string) =>
    persistCovers(
      covers.filter((c) => c !== url),
      "Foto removida."
    );

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= covers.length) return;
    const list = [...covers];
    [list[from], list[to]] = [list[to], list[from]];
    void persistCovers(list, "Ordem atualizada.");
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <p className="text-ink/50">Carregando fotos...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h2 className="font-display text-lg font-bold text-ink">
        Fotos do estabelecimento
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        A foto de perfil aparece como logo do seu negócio. As fotos de capa
        formam o carrossel que o cliente vê no seu perfil.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-4 rounded-xl bg-teal-500/10 px-4 py-2.5 text-sm font-medium text-teal-700">
          {ok}
        </p>
      )}

      {/* Foto de perfil */}
      <div className="mt-5 rounded-xl bg-sand/40 p-4">
        <ImageUpload
          value={photo}
          onChange={(url) => void handleProfileChange(url)}
          folder="estabelecimentos"
          label="Foto de perfil"
          hint="Quadrada de preferência. JPG, PNG ou WEBP, até 5 MB."
        />
      </div>

      {/* Fotos de capa */}
      <div className="mt-5 rounded-xl bg-sand/40 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink/70">
            Fotos de capa (carrossel)
          </span>
          <span className="text-xs font-medium text-ink/40">
            {covers.length} / {MAX_COVERS}
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || covers.length >= MAX_COVERS}
          className="mt-3 w-full rounded-xl border border-dashed border-ink/20 py-5 text-sm font-medium text-ink/60 transition hover:border-teal-500 hover:text-teal-600 disabled:opacity-50 disabled:hover:border-ink/20 disabled:hover:text-ink/60"
        >
          {uploading
            ? "Enviando..."
            : covers.length >= MAX_COVERS
            ? `Limite de ${MAX_COVERS} fotos atingido`
            : `+ Adicionar fotos (até ${MAX_COVERS - covers.length})`}
        </button>

        <p className="mt-1.5 text-xs text-ink/40">
          Horizontais ficam melhores. JPG, PNG ou WEBP, até 5 MB cada.
        </p>

        {covers.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                      onClick={() => move(i, -1)}
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
                      onClick={() => move(i, 1)}
                      disabled={i === covers.length - 1}
                      aria-label="Mover para frente"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink transition hover:bg-white disabled:opacity-30"
                    >
                      ›
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Prévia do carrossel
              </span>
              <PhotoCarousel photos={covers} heightClass="h-48" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}