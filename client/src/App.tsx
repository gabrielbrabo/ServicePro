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
import { ProfilePage } from "./pages/ProfilePage";
import { EstablishmentEditPage } from "./pages/EstablishmentEditPage";
import { AnamnesePublicPage } from "./pages/AnamnesePublicPage";
import { AgendaPublicPage } from "./pages/AgendaPublicPage";
import { ReviewPublicPage } from "./pages/ReviewPublicPage";

// Para onde mandar um usuario logado: se tem estabelecimento (dono OU
// funcionario) vai para o painel; senao (cliente) vai para a busca.
function useHomePath(): string | null {
  const { user, loading } = useAuth();
  const { status, establishments } = useEstablishments();
  if (loading) return null;
  if (!user) return "/buscar";
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

export default function App() {
  return (
    <AuthProvider>
      <EstablishmentProvider>
        <NotificationProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
              <Route path="/buscar" element={<SearchPage />} />
              <Route path="/servico/:id" element={<P><ServiceDetailPage /></P>} />
              <Route path="/painel" element={<P><ProviderDashboard /></P>} />
              <Route path="/agendamentos" element={<P><BookingsPage /></P>} />
              <Route path="/perfil" element={<P><ProfilePage /></P>} />
              <Route path="/estabelecimento/:id/editar" element={<P><EstablishmentEditPage /></P>} />

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
          </BrowserRouter>
        </NotificationProvider>
      </EstablishmentProvider>
    </AuthProvider>
  );
}