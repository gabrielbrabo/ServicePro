import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Captura o codigo do afiliado/representante (?ref=...) do link de indicacao e
// guarda no localStorage. E lido depois no cadastro do usuario (AuthContext) e
// do estabelecimento (EstablishmentForm). Sem isto, clicar no link do afiliado
// nao vincula ninguem e o split nunca acontece.
try {
  const _ref = new URLSearchParams(window.location.search).get("ref");
  if (_ref) localStorage.setItem("sp_ref", _ref);
} catch {
  /* ambiente sem localStorage/URL */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);
