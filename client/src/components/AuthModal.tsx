import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { GoogleLoginButton } from "./GoogleLoginButton";

type Mode = "login" | "register";

export function AuthModal({
  onClose,
  onSuccess,
  title = "Entre para agendar",
  subtitle = "Crie sua conta em segundos ou entre com a que já tem.",
}: {
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
}) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("register");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("A senha precisa ter ao menos 6 caracteres.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
        });
      }
      onSuccess();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      if (mode === "login") {
        setError(
          status === 401
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar. Tente novamente."
        );
      } else {
        setError(
          status === 409
            ? "Este e-mail já tem conta. Use a opção Entrar."
            : "Não foi possível criar a conta. Tente novamente."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
    >
      <div
        className="my-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink/60">{subtitle}</p>

        {/* entrar com Google: caminho mais rapido */}
        <div className="mt-5">
          <GoogleLoginButton
            onSuccess={onSuccess}
            onError={(msg) => setError(msg)}
          />
        </div>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-ink/10" />
          <span className="text-xs font-medium uppercase tracking-wide text-ink/40">
            ou
          </span>
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        {/* alternador entrar / criar conta */}
        <div className="mt-5 flex rounded-xl bg-sand p-1">
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "register"
                ? "bg-white text-ink shadow-sm"
                : "text-ink/60 hover:text-ink"
              }`}
          >
            Criar conta
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "login"
                ? "bg-white text-ink shadow-sm"
                : "text-ink/60 hover:text-ink"
              }`}
          >
            Entrar
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {mode === "register" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Nome
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              E-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              Senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "register" ? "Ao menos 6 caracteres" : "Sua senha"
              }
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
            />
          </label>

          {mode === "register" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Telefone (opcional)
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="h-11 w-full rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving
              ? "Aguarde..."
              : mode === "register"
                ? "Criar conta e continuar"
                : "Entrar e continuar"}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full text-center text-sm font-medium text-ink/50 transition hover:text-ink/80 disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}