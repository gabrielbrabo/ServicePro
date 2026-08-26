import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/servicepro",
  jwtSecret: process.env.JWT_SECRET || "chave-insegura-troque",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  // e-mail (Resend) e URL usada nos links de convite
  //resendApiKey: process.env.RESEND_API_KEY || "",
  //emailFrom: process.env.EMAIL_FROM || "ServicePro <onboarding@resend.dev>",
  // link do convite aponta para o frontend; reaproveita clientUrl
  //appUrl: process.env.APP_URL || process.env.CLIENT_URL || "http://localhost:5173",

  // e-mail (Brevo)
  brevoApiKey: process.env.BREVO_API_KEY || "",
  emailFromName: process.env.EMAIL_FROM_NAME || "ServicePro",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || "",
  // link do convite aponta para o frontend
  appUrl: process.env.APP_URL || process.env.CLIENT_URL || "http://localhost:5173",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",

  // WhatsApp (Meta Cloud API) — numero unico do ServicePro
  whatsappToken: process.env.WHATSAPP_TOKEN || "",
  whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
  whatsappLang: process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR",
  whatsappTemplates: {
    confirmed:
      process.env.WHATSAPP_TEMPLATE_CONFIRMED || "agendamento_confirmado",
    cancelled:
      process.env.WHATSAPP_TEMPLATE_CANCELLED || "agendamento_cancelado",
    rescheduled:
      process.env.WHATSAPP_TEMPLATE_RESCHEDULED || "agendamento_remarcado",
    reminder: process.env.WHATSAPP_TEMPLATE_REMINDER || "lembrete_agendamento",
  },

  // Assinatura digital (Clicksign) — vazio = desligado (no-op, nada quebra)
  clicksign: {
    token: process.env.CLICKSIGN_API_TOKEN || "",
    baseUrl: process.env.CLICKSIGN_BASE_URL || "https://sandbox.clicksign.com",
    webhookSecret: process.env.CLICKSIGN_WEBHOOK_SECRET || "",
    // tipo de autenticacao exigido do signatario.
    // "icp_brasil" = certificado ICP-Brasil (validade juridica, producao).
    // "email" = token por e-mail — util para TESTAR no sandbox sem certificado.
    signAuth: process.env.CLICKSIGN_SIGN_AUTH || "icp_brasil",
  },
};

// true quando ha token do Clicksign configurado (habilita a assinatura)
export function signingConfigured(): boolean {
  return !!env.clicksign.token;
}