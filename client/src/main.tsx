// monitoramento de erros: primeiro import, antes do app
import { Sentry } from "./lib/sentry";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { captureRefFromUrl } from "./lib/ref";

// Captura o codigo do afiliado/representante (?ref=...) do link de indicacao e
// guarda no localStorage. E lido depois no cadastro do usuario (AuthContext) e
// do estabelecimento (EstablishmentForm). Sem isto, clicar no link do afiliado
// nao vincula ninguem e o split nunca acontece.
captureRefFromUrl();

// aviso exibido se uma tela quebrar (o erro ja foi enviado ao Sentry)
function CrashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-6 text-center">
      <div className="max-w-sm">
        <p className="text-4xl">😕</p>
        <h1 className="mt-3 font-display text-xl font-bold text-ink">
          Algo deu errado nesta tela
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          Já fomos avisados do problema. Recarregue a página para continuar.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
        >
          Recarregar
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* tela quebrou: registra no Sentry e mostra um aviso amigavel */}
    <Sentry.ErrorBoundary fallback={<CrashScreen />}>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
