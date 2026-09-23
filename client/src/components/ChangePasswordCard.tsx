import { useState, FormEvent } from "react";
import { authApi, User } from "../api/auth";
import { PasswordField } from "./PasswordField";
import { apiMessage, isPasswordValid } from "../lib/password";

// Secao "Seguranca" do perfil: troca de senha exigindo a senha atual.
export function ChangePasswordCard({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [sendingForgot, setSendingForgot] = useState(false);

  const isGoogleOnly = user.authProvider === "google";

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!current) {
      setError("Informe a senha atual.");
      return;
    }
    if (!isPasswordValid(next)) {
      setError("A nova senha não atende aos requisitos.");
      return;
    }
    if (next !== confirm) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    if (next === current) {
      setError("A nova senha precisa ser diferente da atual.");
      return;
    }

    setSaving(true);
    try {
      const res = await authApi.changePassword(current, next);
      // o token antigo deixou de valer: guarda o novo para seguir logado
      localStorage.setItem("token", res.token);
      reset();
      setOpen(false);
      setSuccess(
        "Senha alterada. As sessões em outros dispositivos foram encerradas."
      );
    } catch (err) {
      setError(apiMessage(err, "Não foi possível alterar a senha."));
    } finally {
      setSaving(false);
    }
  };

  // esqueceu a senha atual: manda o link de redefinicao para o proprio e-mail
  const sendForgot = async () => {
    setSendingForgot(true);
    setForgotMsg(null);
    try {
      // na area do afiliado o link do e-mail volta para o login dele
      let area: "app" | "affiliate" = "app";
      try {
        if (localStorage.getItem("sp_area") === "affiliate") area = "affiliate";
      } catch {
        /* ignora */
      }
      await authApi.forgotPassword(user.email, area);
      setForgotMsg(`Enviamos um link de redefinição para ${user.email}.`);
    } catch (err) {
      setForgotMsg(apiMessage(err, "Não foi possível enviar o link."));
    } finally {
      setSendingForgot(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-6">
      <h2 className="font-display text-lg font-bold text-ink">Segurança</h2>

      {success && (
        <div className="mt-3 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
          {success}
        </div>
      )}

      {isGoogleOnly ? (
        <p className="mt-2 text-sm text-ink/60">
          Você entra com a sua conta Google — não há senha do ServiçosPro para
          alterar. A segurança do acesso é gerenciada pelo Google.
        </p>
      ) : !open ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink/60">
            Altere sua senha de acesso periodicamente.
          </p>
          <button
            onClick={() => {
              reset();
              setSuccess(null);
              setForgotMsg(null);
              setOpen(true);
            }}
            className="rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/80 transition hover:bg-sand"
          >
            Alterar senha
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <PasswordField
              id="current-password"
              label="Senha atual"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={sendForgot}
              disabled={sendingForgot}
              className="mt-1.5 text-xs font-semibold text-teal-600 hover:underline disabled:opacity-60"
            >
              {sendingForgot ? "Enviando..." : "Esqueci minha senha atual"}
            </button>
            {forgotMsg && (
              <p className="mt-1 text-xs text-ink/60">{forgotMsg}</p>
            )}
          </div>

          <PasswordField
            id="new-password"
            label="Nova senha"
            value={next}
            onChange={setNext}
            showRules
          />
          <PasswordField
            id="confirm-password"
            label="Confirmar nova senha"
            value={confirm}
            onChange={setConfirm}
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <p className="text-xs text-ink/45">
            Por segurança, você será desconectado dos outros dispositivos.
          </p>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar nova senha"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={saving}
              className="rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
