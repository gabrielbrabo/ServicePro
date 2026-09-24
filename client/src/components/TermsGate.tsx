import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth";
import { TermsCheckbox } from "./TermsCheckbox";
import { LEGAL_UPDATED_LABEL } from "../lib/legal";

// Pede o aceite dos Termos/Politica a quem esta logado e ainda nao aceitou a
// versao vigente: contas antigas, contas criadas com Google e todos os
// usuarios quando a versao dos termos muda. Bloqueia o app ate aceitar
// (ou sair). Nao aparece nas proprias paginas dos termos, para poder ler.
export function TermsGate() {
  const { user, updateUser, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !user.mustAcceptTerms) return null;
  if (pathname === "/termos" || pathname === "/privacidade") return null;

  const accept = async () => {
    if (!checked) {
      setError("Marque a caixa para continuar.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await authApi.acceptTerms();
      updateUser({ ...updated, mustAcceptTerms: false });
    } catch {
      setError("Não foi possível registrar o aceite. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const leave = () => {
    let affiliate = false;
    try {
      affiliate = localStorage.getItem("sp_area") === "affiliate";
    } catch {
      /* ignora */
    }
    logout();
    navigate(affiliate ? "/afiliado/login" : "/login", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm">
      <div className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-2xl">
          📄
        </div>
        <h2 className="font-display text-xl font-bold text-ink">
          Termos de Uso e Política de Privacidade
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/65">
          Olá, {user.name.split(" ")[0]}! Para continuar usando o ServiçosPro,
          leia e aceite os nossos Termos de Uso e a Política de Privacidade
          (versão de {LEGAL_UPDATED_LABEL}). Eles explicam como a plataforma
          funciona e como cuidamos dos seus dados, de acordo com a LGPD.
        </p>

        <div className="mt-5">
          <TermsCheckbox checked={checked} onChange={setChecked} id="gate-terms" />
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={accept}
          disabled={saving}
          className="mt-5 h-11 w-full rounded-xl bg-teal-500 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Aceitar e continuar"}
        </button>
        <button
          type="button"
          onClick={leave}
          disabled={saving}
          className="mt-2 w-full text-center text-sm font-medium text-ink/50 transition hover:text-ink/80"
        >
          Não aceito — sair da conta
        </button>
      </div>
    </div>
  );
}
