import { useEffect, useState, useCallback } from "react";
import { receivablesApi, ReceivablesPayload } from "../api/receivables";
import { useAuth } from "../context/AuthContext";

// "Configurar recebimentos" (Fluxo 2): cria a subconta Asaas do estabelecimento
// para receber os pagamentos do cliente (sinal/serviço) via split.
export function ReceivablesManager({
  establishment,
}: {
  establishment: { _id: string };
}) {
  const { user } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [reusableFrom, setReusableFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [personType, setPersonType] = useState<"fisica" | "juridica">("fisica");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [mobilePhone, setMobilePhone] = useState(user?.phone || "");
  const [postalCode, setPostalCode] = useState("");
  const [incomeValue, setIncomeValue] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [companyType, setCompanyType] = useState("MEI");

  const load = useCallback(() => {
    setLoading(true);
    receivablesApi
      .get(establishment._id)
      .then((s) => {
        setConfigured(s.configured);
        setReusableFrom(s.reusableFrom || null);
      })
      .catch(() => setError("Não foi possível carregar."))
      .finally(() => setLoading(false));
  }, [establishment._id]);

  useEffect(load, [load]);

  const reuse = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await receivablesApi.reuse(establishment._id);
      setConfigured(res.configured);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Não foi possível reutilizar a conta.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!cpfCnpj.trim() || !email.trim() || !mobilePhone.trim() || !postalCode.trim() || !incomeValue) {
      setError("Preencha CPF/CNPJ, e-mail, celular, CEP e faturamento mensal.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: ReceivablesPayload = {
        cpfCnpj: cpfCnpj.trim(),
        email: email.trim(),
        mobilePhone: mobilePhone.trim(),
        postalCode: postalCode.trim(),
        incomeValue: Number(incomeValue),
        birthDate: personType === "fisica" ? birthDate || undefined : undefined,
        companyType: personType === "juridica" ? companyType : undefined,
      };
      const res = await receivablesApi.setup(establishment._id, payload);
      setConfigured(res.configured);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Não foi possível ativar os recebimentos.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500";

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-5 text-ink/50">
        Carregando...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">
            Recebimentos
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Para receber pagamentos e sinais dos clientes pelo app.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            configured
              ? "bg-teal-500/10 text-teal-700"
              : "bg-amber-400/15 text-amber-700"
          }`}
        >
          {configured ? "Ativo" : "Não configurado"}
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {configured ? (
        <div className="mt-4 space-y-2 rounded-xl bg-teal-500/5 p-4 text-sm text-ink/80">
          <p>
            Recebimentos ativos. Os pagamentos dos clientes caem direto na sua
            conta (menos a taxa da processadora).
          </p>
          <p className="text-ink/60">
            <b>Confira o e-mail do Asaas</b> para concluir a verificação da sua
            conta e liberar os saques. Por lá você saca (100 transferências PIX
            grátis por mês), paga contas e usa o saldo — conta digital sem
            mensalidade.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {reusableFrom && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4">
              <p className="text-sm text-ink/80">
                Você já tem uma conta de recebimento configurada em{" "}
                <b>{reusableFrom}</b>. Use a mesma aqui — o dinheiro deste
                estabelecimento cai na mesma conta.
              </p>
              <button
                type="button"
                onClick={reuse}
                disabled={saving}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
              >
                {saving ? "Usando..." : "Usar a mesma conta"}
              </button>
            </div>
          )}

          <p className="text-xs text-ink/50">
            {reusableFrom
              ? "Ou cadastre uma conta de recebimento nova (outro CPF/CNPJ):"
              : "Esses dados vão para a processadora de pagamentos (Asaas) criar sua conta de recebimento. Depois de ativar, o Asaas envia um e-mail para você concluir a verificação da conta — é por lá que você recebe e saca o dinheiro."}
          </p>

          {/* tipo de pessoa */}
          <div className="inline-flex rounded-xl bg-sand/60 p-1 text-sm">
            {(["fisica", "juridica"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPersonType(t)}
                className={`rounded-lg px-4 py-1.5 font-medium transition ${
                  personType === t ? "bg-white text-ink shadow-sm" : "text-ink/60"
                }`}
              >
                {t === "fisica" ? "Pessoa física" : "Pessoa jurídica"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder={personType === "fisica" ? "CPF" : "CNPJ"}
              inputMode="numeric"
              className={inputClass}
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              type="email"
              className={inputClass}
            />
            <input
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              placeholder="Celular"
              inputMode="numeric"
              className={inputClass}
            />
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="CEP"
              inputMode="numeric"
              className={inputClass}
            />
            <input
              value={incomeValue}
              onChange={(e) => setIncomeValue(e.target.value)}
              placeholder="Faturamento mensal (R$)"
              inputMode="numeric"
              className={inputClass}
            />
            {personType === "fisica" ? (
              <input
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="Nascimento"
                type="date"
                className={inputClass}
              />
            ) : (
              <select
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value)}
                className={inputClass}
              >
                <option value="MEI">MEI</option>
                <option value="LIMITED">Ltda</option>
                <option value="INDIVIDUAL">Empresário individual</option>
                <option value="ASSOCIATION">Associação</option>
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? "Ativando..." : "Ativar recebimentos"}
          </button>
        </div>
      )}
    </div>
  );
}
