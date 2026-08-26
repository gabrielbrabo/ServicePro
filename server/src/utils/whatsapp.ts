import { env } from "../config/env";

// Cliente do WhatsApp via Meta Cloud API (numero unico do ServicePro).
// Credenciais no .env. Tudo fire-and-forget e falha silenciosa: um WhatsApp
// que nao sai jamais pode derrubar a resposta HTTP do agendamento.

export const whatsappConfigured = (): boolean =>
  !!(env.whatsappToken && env.whatsappPhoneId);

// normaliza telefone BR para E.164 sem "+": "(11) 99999-9999" -> "5511999999999"
export const normalizePhoneBR = (raw?: string | null): string | null => {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55")) return d.length >= 12 ? d : null;
  if (d.length === 10 || d.length === 11) return "55" + d; // DDD + numero
  return d.length >= 12 ? d : null;
};

// envia uma mensagem de TEMPLATE (business-initiated). Os templates precisam
// estar APROVADOS na Meta com o mesmo nome e a mesma quantidade de variaveis.
export const sendWhatsappTemplate = async (
  to: string | null | undefined,
  templateName: string,
  params: string[] = []
): Promise<void> => {
  if (!whatsappConfigured() || !templateName) return;
  const phone = normalizePhoneBR(to);
  if (!phone) return;
  try {
    const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneId}/messages`;
    const body = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: env.whatsappLang },
        ...(params.length
          ? {
              components: [
                {
                  type: "body",
                  parameters: params.map((t) => ({
                    type: "text",
                    text: String(t ?? ""),
                  })),
                },
              ],
            }
          : {}),
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("whatsapp send falhou:", res.status, txt);
    }
  } catch (err) {
    console.error("sendWhatsappTemplate:", err);
  }
};
