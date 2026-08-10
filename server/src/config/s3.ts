import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Cliente S3 unico, reutilizado pelos controllers.
// Credenciais vem do .env (nunca commitar).
export const s3 = new S3Client({
  region: process.env.AWS_REGION || "sa-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET || "";
export const S3_REGION = process.env.AWS_REGION || "sa-east-1";

// pastas validas dentro do bucket (espelha ALLOWED_FOLDERS do uploadController)
const ALLOWED_FOLDERS = [
  "profissionais",
  "servicos",
  "estabelecimentos",
  "galeria",
  "produtos",
  "usuarios",
];

// URL publica final de um objeto (bucket com leitura publica)
export const publicUrl = (key: string): string =>
  `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

// caminho inverso: extrai a key a partir da URL publica.
// https://bucket.s3.regiao.amazonaws.com/produtos/uuid.jpg -> produtos/uuid.jpg
// Devolve null se a URL nao for do nosso bucket ou a pasta nao for conhecida.
export const keyFromUrl = (url: unknown): string | null => {
  if (typeof url !== "string" || !url.trim()) return null;

  const marker = ".amazonaws.com/";
  const i = url.indexOf(marker);
  if (i === -1) return null;

  const key = url.slice(i + marker.length).split("?")[0];
  if (!key) return null;

  const folder = key.split("/")[0];
  if (!ALLOWED_FOLDERS.includes(folder)) return null;

  return key;
};

// Remove um objeto do bucket a partir da URL publica.
// FALHA SILENCIOSA de proposito: apagar do S3 nunca deve derrubar a operacao
// principal (delete/update no Mongo). No pior caso fica um arquivo orfao.
export const deleteS3ByUrl = async (url: unknown): Promise<void> => {
  try {
    if (!S3_BUCKET) return;

    const key = keyFromUrl(url);
    if (!key) return;

    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (err) {
    console.error("deleteS3ByUrl:", err);
  }
};

// Versao para varias URLs de uma vez (ex: par antes/depois da galeria).
export const deleteS3ByUrls = async (urls: unknown[]): Promise<void> => {
  await Promise.all(urls.map((u) => deleteS3ByUrl(u)));
};