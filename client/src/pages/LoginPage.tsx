import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "./AuthLayout";
import { Button, Input, FieldError } from "../components/ui";
import { AxiosError } from "axios";
import { GoogleLoginButton } from "../components/GoogleLoginButton";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      navigate(u.hasEstablishments ? "/painel" : "/buscar");
    } catch (err) {
      const ax = err as AxiosError<{ message: string }>;
      setError(ax.response?.data?.message || "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Entrar" subtitle="Bem-vindo de volta ao ServicePro.">
      <GoogleLoginButton
        onSuccess={(u) => navigate(u.hasEstablishments ? "/painel" : "/buscar")}
        onError={(msg) => setError(msg)}
      />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink/40">
          ou
        </span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FieldError>{error}</FieldError>
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        Não tem conta?{" "}
        <Link to="/register" className="font-semibold text-teal-500">
          Criar conta
        </Link>
      </p>

      {/* visitante pode voltar a navegar sem criar conta */}
      <p className="mt-4 border-t border-ink/10 pt-4 text-center">
        <Link
          to="/buscar"
          className="inline-flex items-center gap-1 text-sm font-medium text-ink/50 transition hover:text-ink/80"
        >
          ← Voltar para a busca
        </Link>
      </p>
    </AuthLayout>
  );
}