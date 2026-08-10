import { useRef, useState } from "react";
import { uploadImage, UploadFolder } from "../api/upload";

export function ImageUpload({
  value,
  onChange,
  folder,
  label = "Imagem",
  hint,
}: {
  value?: string; // URL atual (se já houver)
  onChange: (url: string) => void;
  folder: UploadFolder;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setError(null);

    // validação local (o backend valida de novo)
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Imagem muito grande (máximo 5 MB).");
      return;
    }

    setUploading(true);
    try {
      const { url } = await uploadImage(file, folder);
      onChange(url);
    } catch {
      setError("Não foi possível enviar a imagem. Tente novamente.");
    } finally {
      setUploading(false);
      // limpa para permitir reenviar o mesmo arquivo
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink/70">
        {label}
      </span>

      <div className="flex items-center gap-3">
        {/* prévia */}
        {value ? (
          <img
            src={value}
            alt="Prévia"
            className="h-16 w-16 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-ink/20 text-2xl text-ink/30">
            🖼
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition hover:border-teal-500 hover:text-teal-600 disabled:opacity-60"
          >
            {uploading
              ? "Enviando..."
              : value
              ? "Trocar imagem"
              : "Escolher imagem"}
          </button>

          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-left text-xs font-medium text-red-500 hover:underline"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {hint && !error && (
        <p className="mt-1.5 text-xs text-ink/40">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}