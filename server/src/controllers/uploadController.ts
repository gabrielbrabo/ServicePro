import { Response } from "express";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { s3, S3_BUCKET, publicUrl } from "../config/s3";
import { AuthRequest } from "../middleware/auth";

// tipos de imagem aceitos
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// tamanho maximo aceito (5 MB)
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// pastas permitidas dentro do bucket (organiza os uploads)
const ALLOWED_FOLDERS = [
  "profissionais",
  "servicos",
  "estabelecimentos",
  "galeria",
  "produtos",
  "usuarios",
];

// extensao a partir do mime
const extFromMime = (mime: string): string => {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
};

// POST /api/uploads/presign  (protegido)
// body: { folder, contentType, size }
// devolve: { uploadUrl, publicUrl, key }
//
// O front faz PUT do arquivo em uploadUrl (com o mesmo Content-Type)
// e depois salva publicUrl no campo correspondente.
export const presignUpload = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { folder, contentType, size } = req.body;

    if (!S3_BUCKET) {
      res.status(500).json({ message: "Storage nao configurado no servidor" });
      return;
    }

    if (!ALLOWED_FOLDERS.includes(folder)) {
      res.status(400).json({ message: "Pasta de upload invalida" });
      return;
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      res
        .status(400)
        .json({ message: "Tipo de arquivo nao permitido (use JPG, PNG ou WEBP)" });
      return;
    }

    if (typeof size !== "number" || size <= 0 || size > MAX_SIZE_BYTES) {
      res
        .status(400)
        .json({ message: "Arquivo muito grande (maximo 5 MB)" });
      return;
    }

    // chave unica: pasta/uuid.ext
    const key = `${folder}/${randomUUID()}.${extFromMime(contentType)}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    // URL valida por 5 minutos
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    res.json({
      uploadUrl,
      publicUrl: publicUrl(key),
      key,
    });
  } catch (err) {
    console.error("presignUpload:", err);
    res.status(500).json({ message: "Erro ao preparar o upload" });
  }
};

// DELETE /api/uploads  (protegido)
// body: { key }  - remove um objeto do bucket
export const deleteUpload = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { key } = req.body;

    if (!key || typeof key !== "string") {
      res.status(400).json({ message: "Chave invalida" });
      return;
    }

    // so permite apagar dentro das pastas conhecidas
    const folder = key.split("/")[0];
    if (!ALLOWED_FOLDERS.includes(folder)) {
      res.status(400).json({ message: "Chave invalida" });
      return;
    }

    await s3.send(
      new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key })
    );

    res.json({ message: "Arquivo removido", key });
  } catch (err) {
    console.error("deleteUpload:", err);
    res.status(500).json({ message: "Erro ao remover o arquivo" });
  }
};