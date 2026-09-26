import { Request } from "express";

// Versao vigente dos Termos de Uso + Politica de Privacidade. Ao ALTERAR os
// textos (client/src/pages/TermsPage.tsx e PrivacyPage.tsx), troque esta data
// (e a LEGAL_VERSION do front em client/src/lib/legal.ts): todos os usuarios
// verao o aviso para aceitar a nova versao no proximo acesso.
export const LEGAL_VERSION = "2026-09-26";

// dados do aceite gravados no usuario (prova do consentimento — LGPD art. 8)
export const legalAcceptance = (req: Request) => ({
  termsAcceptedAt: new Date(),
  termsVersion: LEGAL_VERSION,
  termsAcceptIp: (req.ip || req.socket.remoteAddress || "").slice(0, 64),
  termsAcceptUA: String(req.headers["user-agent"] || "").slice(0, 300),
});
