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
};