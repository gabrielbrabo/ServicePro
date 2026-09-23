import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-ink/50">
        Carregando...
      </div>
    );
  }

  if (!user) {
    // na area do afiliado/representante, o login certo e o dele
    let affiliateArea = false;
    try {
      affiliateArea = localStorage.getItem("sp_area") === "affiliate";
    } catch {
      /* sem localStorage: usa o login do app */
    }
    return (
      <Navigate to={affiliateArea ? "/afiliado/login" : "/login"} replace />
    );
  }

  return <>{children}</>;
}
