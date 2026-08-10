import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { authApi } from "../api/auth";
import { Logo } from "../components/Logo";

type State = "loading" | "ok" | "error";

export function VerifyEmailPage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    authApi
      .verifyEmail(token)
      .then((res) => {
        setState("ok");
        setMessage(res.message);
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Não foi possível confirmar o e-mail.";
        setState("error");
        setMessage(msg);
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-4">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {state === "loading" && (
          <p className="text-ink/50">Confirmando seu e-mail...</p>
        )}

        {state === "ok" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/10 text-3xl">
              ✓
            </div>
            <h1 className="font-display text-2xl font-bold text-ink">
              E-mail confirmado
            </h1>
            <p className="mt-2 text-ink/60">{message}</p>
            <Link
              to="/buscar"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
            >
              Continuar
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">
              Não foi possível confirmar
            </h1>
            <p className="mt-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {message}
            </p>
            <p className="mt-4 text-sm text-ink/60">
              Entre no app e peça um novo link de confirmação.
            </p>
            <Link
              to="/buscar"
              className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline"
            >
              Ir para o app
            </Link>
          </>
        )}
      </div>
    </div>
  );
}