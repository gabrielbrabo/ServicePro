import crypto from "crypto";
import { env, signingConfigured } from "../config/env";

// Integracao de assinatura digital (Clicksign, API v3 — formato JSON:API).
// Fluxo: cria envelope -> sobe o PDF -> cria signatario -> cria requisitos
// (qualificacao "sign" + autenticacao "icp_brasil") -> ativa o envelope.
// Enquanto CLICKSIGN_API_TOKEN estiver vazio, signingConfigured() e false e
// nada e chamado (no-op), igual ao WhatsApp.
//
// ⚠️ A validar no sandbox: a forma exata dos requisitos e do payload do webhook
// pode precisar de ajuste fino contra as respostas reais da API.

export { signingConfigured };

const JSON_API = "application/vnd.api+json";

interface CsResponse {
  data?: { id?: string; [k: string]: unknown };
  errors?: unknown;
}

// chamada base para a API v3 do Clicksign
async function cs(
  path: string,
  method: "POST" | "PATCH" | "GET",
  body?: unknown
): Promise<CsResponse> {
  const url = `${env.clicksign.baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: env.clicksign.token,
      "Content-Type": JSON_API,
      Accept: JSON_API,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: CsResponse = {};
  try {
    json = text ? (JSON.parse(text) as CsResponse) : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    throw new Error(
      `Clicksign ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`
    );
  }
  return json;
}

export interface SignatureRequest {
  pdf: Buffer;
  filename: string; // ex.: "Atestado - Maria.pdf"
  documentName: string; // titulo amigavel do envelope
  signerName: string;
  signerEmail: string;
}

export interface SignatureResult {
  provider: "clicksign";
  requestId: string; // id do envelope
  documentId: string;
}

// dispara a solicitacao de assinatura. Retorna o id do envelope (requestId).
export async function requestSignature(
  input: SignatureRequest
): Promise<SignatureResult> {
  if (!signingConfigured()) {
    throw new Error("Assinatura digital nao configurada");
  }

  // 1) cria o envelope. auto_close = fecha sozinho quando todos assinarem
  // (senao o envelope fica "running" para sempre e o status nunca vira assinado)
  const envelope = await cs("/api/v3/envelopes", "POST", {
    data: {
      type: "envelopes",
      attributes: {
        name: input.documentName,
        locale: "pt-BR",
        auto_close: true,
      },
    },
  });
  const envelopeId = envelope.data?.id;
  if (!envelopeId) throw new Error("Clicksign: envelope sem id");

  // 2) sobe o PDF (base64)
  const dataUri = `data:application/pdf;base64,${input.pdf.toString("base64")}`;
  const document = await cs(
    `/api/v3/envelopes/${envelopeId}/documents`,
    "POST",
    {
      data: {
        type: "documents",
        attributes: { filename: input.filename, content_base64: dataUri },
      },
    }
  );
  const documentId = document.data?.id;
  if (!documentId) throw new Error("Clicksign: documento sem id");

  // 3) cria o signatario
  const signer = await cs(`/api/v3/envelopes/${envelopeId}/signers`, "POST", {
    data: {
      type: "signers",
      attributes: {
        name: input.signerName,
        email: input.signerEmail,
        communicate_events: {
          document_signed: "email",
          signature_request: "email",
        },
      },
    },
  });
  const signerId = signer.data?.id;
  if (!signerId) throw new Error("Clicksign: signatario sem id");

  const rel = {
    document: { data: { type: "documents", id: documentId } },
    signer: { data: { type: "signers", id: signerId } },
  };

  // 4a) requisito de qualificacao: assina como parte
  await cs(`/api/v3/envelopes/${envelopeId}/requirements`, "POST", {
    data: {
      type: "requirements",
      attributes: { action: "agree", role: "sign" },
      relationships: rel,
    },
  });

  // 4b) requisito de autenticacao. Producao: "icp_brasil" (certificado). No
  // sandbox pode-se usar "email" (CLICKSIGN_SIGN_AUTH=email) para testar o ciclo
  // completo sem certificado.
  await cs(`/api/v3/envelopes/${envelopeId}/requirements`, "POST", {
    data: {
      type: "requirements",
      attributes: {
        action: "provide_evidence",
        auth: env.clicksign.signAuth || "icp_brasil",
      },
      relationships: rel,
    },
  });

  // 5) ativa o envelope (status running)
  await cs(`/api/v3/envelopes/${envelopeId}`, "PATCH", {
    data: {
      id: envelopeId,
      type: "envelopes",
      attributes: { status: "running" },
    },
  });

  // 6) notifica os signatarios — na v3 a ativacao NAO envia o e-mail sozinha;
  // e preciso chamar este endpoint para disparar a solicitacao de assinatura.
  await cs(`/api/v3/envelopes/${envelopeId}/notifications`, "POST", {
    data: {
      type: "notifications",
      attributes: {
        message: "Voce recebeu um documento do ServiçosPro para assinar.",
      },
    },
  });

  return { provider: "clicksign", requestId: envelopeId, documentId };
}

// consulta o status do envelope direto no Clicksign (alternativa ao webhook:
// o app "pergunta" se ja foi assinado, sem precisar de webhook/ngrok).
export async function getEnvelopeStatus(
  envelopeId: string
): Promise<{ status: string; signed: boolean }> {
  if (!signingConfigured()) throw new Error("Assinatura nao configurada");
  // 1 chamada: status do envelope ("closed" = todos assinaram)
  const envRes = await cs(`/api/v3/envelopes/${envelopeId}`, "GET");
  const attrs = (envRes.data?.attributes || {}) as Record<string, unknown>;
  const status = String(attrs.status || "");
  const signed = /closed|finished|complete/i.test(status);
  return { status, signed };
}

// URL FRESCA do PDF assinado (o link do S3 do Clicksign expira em ~5 min, entao
// e gerado na hora do clique, nao armazenado). Fica em data[0].links.files.
export async function getSignedFileUrl(
  envelopeId: string
): Promise<string | undefined> {
  if (!signingConfigured()) return undefined;
  const d = await cs(`/api/v3/envelopes/${envelopeId}/documents`, "GET");
  const dd = (d as unknown as { data?: unknown }).data;
  const arr = Array.isArray(dd) ? dd : [];
  const first = (arr[0] || {}) as Record<string, unknown>;
  const links = (first.links || {}) as Record<string, unknown>;
  const files = (links.files || {}) as Record<string, unknown>;
  // SO o arquivo assinado (files.signed). NUNCA cair para files.original, que e
  // a minuta sem assinatura. Se ainda nao estiver pronto, retorna undefined.
  const url = files.signed as unknown;
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : undefined;
}

// valida a assinatura HMAC-SHA256 do webhook (corpo bruto x segredo)
export function verifyWebhook(rawBody: Buffer, headerHmac?: string): boolean {
  const secret = env.clicksign.webhookSecret;
  if (!secret) return true; // sem segredo configurado: nao valida (sandbox)
  if (!headerHmac) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  // aceita "sha256=<hex>" ou "<hex>"
  const received = headerHmac.replace(/^sha256=/i, "").trim();
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "hex"),
      Buffer.from(received, "hex")
    );
  } catch {
    return false;
  }
}

export interface WebhookEvent {
  requestId?: string; // id do envelope
  signed: boolean; // documento finalizado/assinado
  signedUrl?: string; // url do PDF assinado, quando disponivel
}

// extrai do payload do webhook o que interessa. Defensivo: a estrutura exata
// varia por evento — a validar no sandbox.
export function parseWebhookEvent(body: unknown): WebhookEvent {
  const b = (body || {}) as Record<string, unknown>;
  const event = b.event as Record<string, unknown> | string | undefined;
  const eventName =
    typeof event === "string"
      ? event
      : (event?.name as string) || (b.type as string) || "";

  const data = (b.data || (event as Record<string, unknown>)?.data || {}) as Record<
    string,
    unknown
  >;

  // procura o id do envelope em locais comuns do payload
  const requestId =
    (data.id as string) ||
    ((data.envelope as Record<string, unknown>)?.id as string) ||
    ((b.envelope as Record<string, unknown>)?.id as string) ||
    undefined;

  // url do documento assinado, se veio
  const signedUrl =
    (data.signed_file_url as string) ||
    (data.download_url as string) ||
    ((data.document as Record<string, unknown>)?.signed_file_url as string) ||
    undefined;

  // eventos que indicam finalizacao/assinatura
  const signed = /sign|close|finish|complete/i.test(eventName);

  return { requestId, signed, signedUrl };
}
