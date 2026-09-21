import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button, Input, FieldError } from "../components/ui";
import { AxiosError } from "axios";
import { affiliateApi } from "../api/affiliate";

// Login da área do afiliado/representante — separada da do estabelecimento,
// como um sistema à parte. Usa a mesma conta; se a conta ainda não for de
// afiliado, o back devolve notAffiliate e mandamos para o cadastro.
export function AffiliateLoginPage() {
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
      const { token } = await affiliateApi.login({ email, password });
      localStorage.setItem("token", token);
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
      title="Área do afiliado/representante"
      subtitle="Acompanhe seus indicados e suas comissões."
    >
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
