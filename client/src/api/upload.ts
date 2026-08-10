import { api } from "../lib/api";

export type UploadFolder =
  | "profissionais"
  | "servicos"
  | "estabelecimentos"
  | "galeria"
  | "produtos"
  | "usuarios";

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export const uploadApi = {
  presign: (data: {
    folder: UploadFolder;
    contentType: string;
    size: number;
  }) =>
    api
      .post<PresignResponse>("/uploads/presign", data)
      .then((r) => r.data),

  remove: (key: string) =>
    api
      .delete<{ message: string; key: string }>("/uploads", { data: { key } })
      .then((r) => r.data),
};

// Faz o upload completo: pede a URL assinada, sobe o arquivo direto no S3
// e devolve a URL publica final (para salvar no campo do registro).
export async function uploadImage(
  file: File,
  folder: UploadFolder
): Promise<{ url: string; key: string }> {
  // 1. pede autorizacao ao backend
  const { uploadUrl, publicUrl, key } = await uploadApi.presign({
    folder,
    contentType: file.type,
    size: file.size,
  });

  // 2. sobe o arquivo direto para o S3 (nao passa pelo nosso servidor)
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  if (!res.ok) {
    throw new Error(`Falha no upload para o S3 (${res.status})`);
  }

  return { url: publicUrl, key };
}

// extrai a key do S3 a partir da URL publica
// https://bucket.s3.regiao.amazonaws.com/estabelecimentos/uuid.jpg
//   -> estabelecimentos/uuid.jpg
export function keyFromUrl(url: string): string | null {
  const marker = ".amazonaws.com/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const key = url.slice(i + marker.length).split("?")[0];
  return key || null;
}

// remove o objeto do bucket. Falha silenciosa: se nao der, o arquivo fica
// orfao no S3, mas a UI nao quebra.
export async function deleteUploadByUrl(url: string): Promise<void> {
  const key = keyFromUrl(url);
  if (!key) return;
  try {
    await api.delete("/uploads", { data: { key } });
  } catch {
    // ignorado de proposito
  }
}