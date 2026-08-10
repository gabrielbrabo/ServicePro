import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { EstablishmentProvider } from "./context/EstablishmentContext";
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

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/buscar" replace /> : <>{children}</>;
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

              <Route path="/convite/:token" element={<InviteAcceptPage />} />
              {/* IMPORTANTE: rotas especificas SEMPRE antes do catch-all "*" */}
              <Route path="/verificar-email/:token" element={<VerifyEmailPage />} />

              <Route path="/" element={<Navigate to="/buscar" replace />} />
              <Route path="*" element={<Navigate to="/buscar" replace />} />
            </Routes>

            {/* aviso in-app de vaga liberada (lista de espera) — vive em todas as rotas */}
            <WaitlistToast />
          </BrowserRouter>
        </NotificationProvider>
      </EstablishmentProvider>
    </AuthProvider>
  );
}