// Monitoramento de erros do front (Sentry). Importado primeiro no main.tsx.
// Ativo so no build de producao (npm run build / Netlify).
//
// Privacidade (LGPD): sem dados pessoais — nada de usuario, cookies,
// cabecalhos, corpo de requisicoes ou query strings (links com token, como
// redefinir senha e convites, tem a URL limpa antes do envio).
import * as Sentry from "@sentry/react";

// DSN do projeto React no Sentry. A DSN do front e publica por natureza (vai
// dentro do JS que o navegador baixa), entao pode ficar no codigo.
const SENTRY_DSN_REACT =
  "https://6382f0fd3ab5e9ce022d40bfeeb15b64@o4512141614448640.ingest.us.sentry.io/4512141643218944";

// VITE_SENTRY_DSN (Netlify) tem prioridade. Sem ela, usa a DSN acima SO no
// build de producao — em desenvolvimento (npm run dev) fica desligado.
const dsn =
  import.meta.env.VITE_SENTRY_DSN ||
  (import.meta.env.PROD ? SENTRY_DSN_REACT : undefined);

// tira tokens e parametros das URLs (ex.: /redefinir-senha/<token>)
const cleanUrl = (url?: string): string | undefined => {
  if (!url) return url;
  return url
    .split("?")[0]
    .replace(
      /\/(redefinir-senha|convite|verificar-email|avaliar)\/[^/]+/g,
      "/$1/:token"
    );
};

export const sentryEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // so erros (sem medicao de desempenho nem gravacao de sessao)
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // erros comuns de navegador/rede que nao sao bugs do sistema
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Network Error",
      "Failed to fetch",
      "Load failed",
    ],
    beforeSend(event) {
      if (event.request) {
        event.request.url = cleanUrl(event.request.url);
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        delete event.request.headers;
      }
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
    beforeBreadcrumb(crumb) {
      // navegacao e chamadas a API ficam no historico do erro: limpa as URLs
      if (crumb.data) {
        for (const k of ["url", "from", "to"]) {
          if (typeof crumb.data[k] === "string")
            crumb.data[k] = cleanUrl(crumb.data[k] as string);
        }
      }
      return crumb;
    },
  });
}

export { Sentry };
