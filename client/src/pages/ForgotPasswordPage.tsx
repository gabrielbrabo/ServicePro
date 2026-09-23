import { useState, FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button, Input, FieldError } from "../components/ui";
import { authApi } from "../api/auth";
import { apiMessage } from "../lib/password";

// area "affiliate": mesma tela, mas o link do e-mail e o "voltar" levam para o
// login do afiliado/representante
export function ForgotPasswordPage({
  area = "app",
}: {
  area?: "app" | "affiliate";
}) {
  const loginPath = area === "affiliate" ? "/afiliado/login" : "/login";
  // o login passa o e-mail ja digitado (economiza redigitar)
  const location = useLocation();
  const initialEmail =
    (location.state as { email?: string } | null)?.email || "";

  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [sentMsg, setSentMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim(), area);
      setSentMsg(res.message);
    } catch (err) {
      setError(apiMessage(err, "Não foi possível enviar. Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Esqueceu a senha?"
      subtitle="Informe seu e-mail e enviaremos um link para criar uma nova."
    >
      {sentMsg ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-teal-50 px-4 py-4 text-sm text-teal-800">
            <p className="font-semibold">Verifique seu e-mail</p>
            <p className="mt-1">{sentMsg}</p>
            <p className="mt-2 text-teal-700/80">
              O link vale por 30 minutos. Não achou? Olhe também a caixa de spam.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSentMsg("")}
            className="w-full text-center text-sm font-medium text-teal-600 hover:underline"
          >
            Enviar para outro e-mail
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError>{error}</FieldError>
          <Button type="submit" loading={loading}>
            Enviar link
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink/60">
        Lembrou a senha?{" "}
        <Link to={loginPath} className="font-semibold text-teal-500">
          Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  );
}
