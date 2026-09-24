import { useState, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button, Input, FieldError } from "../components/ui";
import { AxiosError } from "axios";
import { GoogleLoginButton } from "../components/GoogleLoginButton";
import { affiliateApi } from "../api/affiliate";
import { useAuth } from "../context/AuthContext";

// Login da área do afiliado/representante — separada da do estabelecimento.
// Aceita e-mail/senha OU Google. Se a conta ainda não for afiliado, manda pro
// cadastro; se a conta é Google, o back orienta a usar o botão do Google.
export function AffiliateLoginPage() {
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  // aviso vindo da redefinicao de senha
  const notice =
    (useLocation().state as { notice?: string } | null)?.notice || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await affiliateApi.login({ email, password });
      try {
        localStorage.setItem("sp_area", "affiliate");
      } catch {
        /* ignora */
      }
      // carrega o usuario no AuthContext (senao /perfil manda para o login)
      await adoptSession(token);
      navigate("/afiliado");
    } catch (err) {
      const ax = err as AxiosError<{ message: string; notAffiliate?: boolean }>;
      // credenciais certas mas a conta ainda nao e afiliado: leva ao cadastro
      if (ax.response?.data?.notAffiliate) {
        navigate("/seja-afiliado");
        return;
      }
      setError(ax.response?.data?.message || "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      variant="affiliate"
      title="Área do afiliado/representante"
      subtitle="Acompanhe seus indicados e suas comissões."
    >
      {notice && (
        <p className="mb-5 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
          {notice}
        </p>
      )}

      {/* Google: entra e vai pro painel do afiliado (cadastra se ainda não for) */}
      <GoogleLoginButton
        onSuccess={() => {
          try {
            localStorage.setItem("sp_area", "affiliate");
          } catch {
            /* ignora */
          }
          navigate("/afiliado");
        }}
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
        <div className="-mt-2 text-right">
          <Link
            to="/afiliado/esqueci-senha"
            state={{ email }}
            className="text-sm font-medium text-teal-600 hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        Ainda não é afiliado/representante?{" "}
        <Link to="/seja-afiliado" className="font-semibold text-teal-500">
          Cadastre-se
        </Link>
      </p>

      <p className="mt-4 border-t border-ink/10 pt-4 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-ink/50 transition hover:text-ink/80"
        >
          ← Login do estabelecimento
        </Link>
      </p>
    </AuthLayout>
  );
}
