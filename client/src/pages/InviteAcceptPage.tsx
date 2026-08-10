import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { inviteApi, InviteInfo } from "../api/invite";
import { authApi } from "../api/auth";
import { connectSocket } from "../lib/socket";
import { Logo } from "../components/Logo";

export function InviteAcceptPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inviteApi
      .get(token)
      .then((data) => {
        setInfo(data);
        setName(data.userName || data.professionalName || "");
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Convite inválido ou expirado.";
        setLoadError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    if (!info) return;
    // se ainda nao tem conta, exige senha
    if (!info.hasAccount && password.length < 6) {
      setError("Crie uma senha de ao menos 6 caracteres.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await inviteApi.accept(token, {
        name: name.trim() || undefined,
        password: info.hasAccount ? undefined : password,
      });
      // loga o funcionario: guarda o token e conecta, igual ao AuthContext
      localStorage.setItem("token", res.token);
      connectSocket();
      // recarrega para o AuthProvider pegar a sessao e cair no painel
      window.location.href = "/painel";
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Não foi possível aceitar o convite.";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-4">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {loading ? (
          <p className="text-center text-ink/50">Carregando convite...</p>
        ) : loadError ? (
          <div className="text-center">
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {loadError}
            </p>
            <button
              onClick={() => navigate("/login")}
              className="mt-4 text-sm font-medium text-teal-600 hover:underline"
            >
              Ir para o login
            </button>
          </div>
        ) : info ? (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">
              Você foi convidado
            </h1>
            <p className="mt-1 text-ink/60">
              <strong className="text-ink">{info.establishmentName}</strong>{" "}
              convidou você para acessar a agenda como{" "}
              <strong className="text-ink">{info.professionalName}</strong>.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  E-mail
                </label>
                <input
                  readOnly
                  value={info.email}
                  className="w-full rounded-xl border border-ink/15 bg-sand/40 px-3 py-2 text-sm text-ink/60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Seu nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como você quer ser chamado"
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>

              {info.hasAccount ? (
                <p className="rounded-xl bg-teal-500/10 px-4 py-3 text-sm text-teal-700">
                  Você já tem uma conta com este e-mail. Ao continuar, o acesso a
                  este estabelecimento será adicionado à sua conta.
                </p>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Crie uma senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ao menos 6 caracteres"
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                    onKeyDown={(e) => e.key === "Enter" && accept()}
                  />
                </div>
              )}

              {error && (
                <p className="text-sm font-medium text-red-500">{error}</p>
              )}

              <button
                type="button"
                onClick={accept}
                disabled={submitting}
                className="h-11 w-full rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {submitting ? "Confirmando..." : "Aceitar e acessar"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}