import { useEffect, useState, FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button, FieldError } from "../components/ui";
import { PasswordField } from "../components/PasswordField";
import { authApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { apiMessage, isPasswordValid } from "../lib/password";

type State = "checking" | "invalid" | "form";

export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // ?area=afiliado: pedido feito na area do afiliado -> volta ao login dele
  const [params] = useSearchParams();
  const isAffiliate = params.get("area") === "afiliado";
  const loginPath = isAffiliate ? "/afiliado/login" : "/login";
  const forgotPath = isAffiliate ? "/afiliado/esqueci-senha" : "/esqueci-senha";

  const [state, setState] = useState<State>("checking");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [invalidMsg, setInvalidMsg] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // valida o link ao abrir (mostra "expirado" antes de digitar a senha)
  useEffect(() => {
    authApi
      .validateResetToken(token)
      .then((res) => {
        setMaskedEmail(res.email);
        setState("form");
      })
      .catch((err) => {
        setInvalidMsg(
          apiMessage(err, "Este link expirou ou já foi usado. Peça um novo.")
        );
        setState("invalid");
      });
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isPasswordValid(password)) {
      setError("A senha não atende aos requisitos abaixo.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, password);
      // a troca derruba todas as sessoes: se havia alguem logado neste
      // navegador, o token guardado nao vale mais
      if (user) logout();
      navigate(loginPath, { replace: true, state: { notice: res.message } });
    } catch (err) {
      setError(apiMessage(err, "Não foi possível redefinir a senha."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Criar nova senha"
      subtitle={
        maskedEmail
          ? `Defina a nova senha da conta ${maskedEmail}.`
          : "Defina a nova senha da sua conta."
      }
    >
      {state === "checking" && (
        <p className="text-sm text-ink/50">Verificando o link...</p>
      )}

      {state === "invalid" && (
        <div className="space-y-4">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {invalidMsg}
          </p>
          <Link
            to={forgotPath}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-5 font-semibold text-white transition hover:bg-teal-600"
          >
            Pedir novo link
          </Link>
        </div>
      )}

      {state === "form" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            id="new-password"
            label="Nova senha"
            value={password}
            onChange={setPassword}
            showRules
          />
          <PasswordField
            id="confirm-password"
            label="Confirmar nova senha"
            value={confirm}
            onChange={setConfirm}
          />
          <FieldError>{error}</FieldError>
          <Button type="submit" loading={loading}>
            Salvar nova senha
          </Button>
          <p className="text-center text-xs text-ink/45">
            Por segurança, você será desconectado de todos os dispositivos.
          </p>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink/60">
        <Link to={loginPath} className="font-semibold text-teal-500">
          Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  );
}
