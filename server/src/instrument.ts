// Monitoramento de erros (Sentry). PRECISA ser o primeiro import do server.ts
// para instrumentar express/http antes de serem carregados.
//
// Sem SENTRY_DSN no ambiente (ex.: desenvolvimento local), nada e enviado.
//
// Privacidade (LGPD): nao enviamos dados pessoais. Corpo das requisicoes,
// cookies, cabecalhos de autenticacao e query strings sao removidos antes do
// envio — prontuarios, CPF, senhas e tokens nunca saem do servidor.
import dotenv from "dotenv";
import * as Sentry from "@sentry/node";

dotenv.config();

const dsn = process.env.SENTRY_DSN;

// remove de um evento tudo que pode conter dado pessoal
const scrub = <T extends Sentry.ErrorEvent>(event: T): T => {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      const { "user-agent": ua } = event.request.headers;
      event.request.headers = ua ? { "user-agent": ua } : {};
    }
  }
  if (event.user) event.user = { id: event.user.id };
  return event;
};

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "production",
    // nao coletar dados pessoais: usuario, cookies, cabecalhos, corpo, query
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // so erros (sem medicao de desempenho): mantem dentro da cota gratuita
    tracesSampleRate: 0,
    // o codigo trata erros com try/catch + console.error: isso faz cada
    // console.error tambem chegar ao Sentry
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    beforeSend: (event) => scrub(event),
  });
  console.log("[sentry] monitoramento de erros ativo");
}

export { Sentry };
