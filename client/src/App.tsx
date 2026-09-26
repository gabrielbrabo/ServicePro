import { captureRefFromUrl } from "./lib/ref";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  EstablishmentProvider,
  useEstablishments,
} from "./context/EstablishmentContext";
import { NotificationProvider } from "./context/NotificationContext";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SearchPage } from "./pages/SearchPage";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { ProviderDashboard } from "./pages/ProviderDashboard";
import { ProviderPublicPage } from "./pages/ProviderPublicPage";
import { BookingsPage } from "./pages/BookingsPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { EstablishmentPage } from "./pages/EstablishmentPage";
import { WaitlistToast } from "./components/WaitlistToast";
import { InviteAcceptPage } from "./pages/InviteAcceptPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsGate } from "./components/TermsGate";
import { ProfilePage } from "./pages/ProfilePage";
import { EstablishmentEditPage } from "./pages/EstablishmentEditPage";
import { AnamnesePublicPage } from "./pages/AnamnesePublicPage";
import { AgendaPublicPage } from "./pages/AgendaPublicPage";
import { ReviewPublicPage } from "./pages/ReviewPublicPage";
import { AffiliateRegisterPage } from "./pages/AffiliateRegisterPage";
import { AffiliateLoginPage } from "./pages/AffiliateLoginPage";
import { AffiliateDashboardPage } from "./pages/AffiliateDashboardPage";

// Para onde mandar um usuario logado: se tem estabelecimento (dono OU
// funcionario) vai para o painel; senao (cliente) vai para a busca.
function useHomePath(): string | null {
  const { user, loading } = useAuth();
  const { status, establishments } = useEstablishments();
  if (loading) return null;
  if (!user) return "/buscar";
  // se a ultima area usada foi a do afiliado/representante, volta pra la no
  // refresh (senao o usuario "caia" no painel de cliente/dono e se perdia).
  try {
    if (localStorage.getItem("sp_area") === "affiliate") return "/afiliado";
  } catch {
    /* sem localStorage: ignora */
  }
  // aguarda o carregamento de /establishments/mine para nao decidir errado
  if (status === "idle" || status === "loading") return null;
  return establishments.length > 0 ? "/painel" : "/buscar";
}

// rota "/" e catch-all: decide o destino conforme o usuario
function RootRedirect() {
  const home = useHomePath();
  if (!home) return null;
  return <Navigate to={home} replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const home = useHomePath();
  if (loading) return null;
  if (!user) return <>{children}</>;
  if (!home) return null;
  return <Navigate to={home} replace />;
}

function P({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

// Captura o ?ref=<code> do link do afiliado/representante e guarda no
// localStorage. Sobrevive entre visitas ate o cadastro do indicado enviar.
// Roda ja no carregamento do modulo (antes de qualquer redirect da rota "/"
// limpar a URL) e de novo no efeito, por garantia.
captureRefFromUrl();
function RefCapture() {
  useEffect(() => {
    try {
      captureRefFromUrl();
    } catch {
      // ambiente sem localStorage/URLSearchParams: ignora
    }
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <EstablishmentProvider>
        <NotificationProvider>
          <BrowserRouter>
            <RefCapture />
            <Routes>
              <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
              {/* recuperacao de senha: pedido (so deslogado) e link do e-mail (sempre) */}
              <Route path="/esqueci-senha" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
              <Route path="/redefinir-senha/:token" element={<ResetPasswordPage />} />
              {/* documentos legais (publicos) */}
              <Route path="/termos" element={<TermsPage />} />
              <Route path="/privacidade" element={<PrivacyPage />} />
              <Route path="/buscar" element={<SearchPage />} />
              <Route path="/servico/:id" element={<P><ServiceDetailPage /></P>} />
              <Route path="/painel" element={<P><ProviderDashboard /></P>} />
              <Route path="/agendamentos" element={<P><BookingsPage /></P>} />
              <Route path="/perfil" element={<P><ProfilePage /></P>} />
              <Route path="/estabelecimento/:id/editar" element={<P><EstablishmentEditPage /></P>} />

              {/* Programa de afiliados/representantes — area propria (sistema a parte) */}
              <Route path="/seja-afiliado" element={<AffiliateRegisterPage />} />
              <Route path="/afiliado/login" element={<AffiliateLoginPage />} />
              <Route path="/afiliado/esqueci-senha" element={<ForgotPasswordPage area="affiliate" />} />
              <Route path="/afiliado" element={<AffiliateDashboardPage />} />

              {/* pagina publica do estabelecimento (link de divulgacao) */}
              <Route path="/e/:establishmentId" element={<ProviderPublicPage />} />
              {/* alias antigo, mantido para nao quebrar links ja compartilhados */}
              <Route path="/p/:establishmentId" element={<ProviderPublicPage />} />

              {/* perfil publico do estabelecimento — visivel sem login */}
              <Route path="/estabelecimento/:id" element={<EstablishmentPage />} />

              {/* anamnese publica (paciente preenche por link) */}
              <Route path="/anamnese/:establishmentId" element={<AnamnesePublicPage />} />

              {/* agenda publica de divulgacao (banner + botao de agendar) */}
              <Route path="/agenda/:establishmentId" element={<AgendaPublicPage />} />

              {/* avaliacao em 1 toque por link/QR (sem login) */}
              <Route path="/avaliar/:token" element={<ReviewPublicPage />} />

              <Route path="/convite/:token" element={<InviteAcceptPage />} />
              {/* IMPORTANTE: rotas especificas SEMPRE antes do catch-all "*" */}
              <Route path="/verificar-email/:token" element={<VerifyEmailPage />} />

              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>

            {/* aviso in-app de vaga liberada (lista de espera) — vive em todas as rotas */}
            <WaitlistToast />
            {/* pede o aceite dos Termos/Politica a quem ainda nao aceitou */}
            <TermsGate />
          </BrowserRouter>
        </NotificationProvider>
      </EstablishmentProvider>
    </AuthProvider>
  );
}
