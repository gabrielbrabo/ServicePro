/*import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SearchPage } from "./pages/SearchPage";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { ProviderDashboard } from "./pages/ProviderDashboard";
import { ProviderPublicPage } from "./pages/ProviderPublicPage";
import { BookingsPage } from "./pages/BookingsPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";

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
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
          <Route path="/buscar" element={<P><SearchPage /></P>} />
          <Route path="/servico/:id" element={<P><ServiceDetailPage /></P>} />
          <Route path="/painel" element={<P><ProviderDashboard /></P>} />
          <Route path="/e/:establishmentId" element={<P><ProviderPublicPage /></P>} />
          <Route path="/agendamentos" element={<P><BookingsPage /></P>} />
          <Route path="/" element={<Navigate to="/buscar" replace />} />
          <Route path="*" element={<Navigate to="/buscar" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
*/