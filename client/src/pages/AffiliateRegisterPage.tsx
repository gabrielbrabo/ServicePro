import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button, Input, FieldError } from "../components/ui";
import { AxiosError } from "axios";
import { affiliateApi, Affiliate } from "../api/affiliate";
import { useAuth } from "../context/AuthContext";
import { TermsCheckbox } from "../components/TermsCheckbox";
import { GoogleLoginButton } from "../components/GoogleLoginButton";
import { lookupCep } from "../lib/cep";

// Cadastro aberto do afiliado/representante do ServiçosPro. Abre a conta de
// recebimento (subconta Asaas). O link de indicação só é liberado depois que a
// conta Asaas é aprovada — por isso o pós-cadastro orienta a ativar/enviar docs.
// Pode começar com a conta Google: entra com o Google e só completa os dados de
// recebimento (sem senha). Quem já está logado também pula e-mail/senha.
export function AffiliateRegisterPage() {
  const navigate = useNavigate();
  const { user, adoptSession, logout } = useAuth();
  // ja logado (Google ou conta existente): o back usa a conta da sessao
  const loggedIn = Boolean(user);
  // aceite ja registrado na conta (o TermsGate cuida de quem ainda nao aceitou)
  const termsDone = loggedIn && !user?.mustAcceptTerms;

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    cpfCnpj: "",
    birthDate: "",
    postalCode: "",
    address: "",
    addressNumber: "",
    province: "",
  });
  const [error, setError] = useState("");
  // aceite dos Termos de Uso + Politica de Privacidade (LGPD)
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Affiliate | null>(null);
  const [copied, setCopied] = useState(false);

  const update =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!loggedIn && form.password.length < 6) {
      setError("A senha precisa de pelo menos 6 caracteres");
      return;
    }
    if (!form.cpfCnpj || !form.phone) {
      setError("Informe CPF/CNPJ e telefone");
      return;
    }
    const digits = form.cpfCnpj.replace(/\D/g, "");
    const isCnpj = digits.length > 11;
    if (!isCnpj && !form.birthDate) {
      setError("Informe sua data de nascimento");
      return;
    }
    if (
      !form.postalCode ||
      !form.address ||
      !form.addressNumber ||
      !form.province
    ) {
      setError("Preencha o endereço completo (CEP, endereço, número e bairro)");
      return;
    }
    if (!termsDone && !acceptTerms) {
      setError("Aceite os Termos de Uso e a Política de Privacidade");
      return;
    }

    setLoading(true);
    try {
      const { token, affiliate } = await affiliateApi.register({
        // logado: o back usa a conta da sessao (dispensa e-mail/senha)
        ...(loggedIn
          ? {}
          : { name: form.name, email: form.email, password: form.password }),
        phone: form.phone,
        cpfCnpj: form.cpfCnpj,
        birthDate: form.birthDate || undefined,
        postalCode: form.postalCode,
        address: form.address,
        addressNumber: form.addressNumber,
        province: form.province,
        acceptTerms: termsDone ? undefined : acceptTerms,
      });
      // guarda o token e carrega o usuario no AuthContext (perfil funciona)
      try {
        localStorage.setItem("sp_area", "affiliate");
      } catch {
        /* ignora */
      }
      await adoptSession(token).catch(() => undefined);
      setCreated(affiliate);
    } catch (err) {
      const ax = err as AxiosError<{ message: string }>;
      setError(ax.response?.data?.message || "Não foi possível concluir o cadastro");
    } finally {
      setLoading(false);
    }
  };

  // entrou com o Google: se ja for afiliado vai direto ao painel; senao fica
  // aqui e completa so os dados de recebimento
  const handleGoogle = async () => {
    setError("");
    try {
      await affiliateApi.me();
      try {
        localStorage.setItem("sp_area", "affiliate");
      } catch {
        /* ignora */
      }
      navigate("/afiliado");
    } catch {
      /* ainda nao e afiliado: segue no formulario */
    }
  };

  // CEP: preenche endereco/bairro e avisa se o CEP nao existe (o Asaas recusa
  // CEP invalido na hora de abrir a conta de recebimento)
  const [cepHint, setCepHint] = useState("");
  const onCepBlur = async () => {
    setCepHint("");
    const r = await lookupCep(form.postalCode);
    if (r === null) {
      setCepHint("CEP não encontrado. Confira os números.");
    } else if (r) {
      setForm((f) => ({
        ...f,
        address: r.address || f.address,
        province: r.province || f.province,
      }));
    }
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ambiente sem clipboard */
    }
  };

  // pós-cadastro
  if (created) {
    // modelo antigo com conta ainda NÃO aprovada (sem link): orienta a ativar
    if (!created.link) {
      return (
        <AuthLayout
          variant="affiliate"
          title="Quase lá! Ative sua conta"
          subtitle="Falta ativar sua conta de recebimento para liberar seu link."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-4 text-sm text-ink/70">
              <p className="font-semibold text-ink">Como liberar seu link</p>
              <ol className="mt-2 space-y-1">
                <li>
                  <strong>1.</strong> Abra o <strong>e-mail do Asaas</strong>{" "}
                  enviado para{" "}
                  <strong className="break-all">
                    {user?.email || form.email || "o e-mail do seu cadastro"}
                  </strong>{" "}
                  e confirme o acesso.
                </li>
                <li>
                  <strong>2.</strong> Envie os <strong>documentos</strong> para a
                  verificação da conta.
                </li>
                <li>
                  <strong>3.</strong> Após a <strong>aprovação</strong>, seu link
                  de indicação é liberado no painel.
                </li>
              </ol>
              <p className="mt-2 text-xs text-ink/50">
                O link só aparece depois da aprovação — assim sua comissão sempre
                cai certinho.
              </p>
            </div>
            <Button type="button" onClick={() => navigate("/afiliado")}>
              Ir para o painel
            </Button>
          </div>
        </AuthLayout>
      );
    }

    // link liberado: mostra direto para já começar a divulgar
    return (
      <AuthLayout
        variant="affiliate"
        title="Você é afiliado/representante!"
        subtitle="Compartilhe seu link e ganhe 25% de cada indicado, para sempre."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Seu link de indicação
            </span>
            <div className="flex gap-2">
              <input
                readOnly
                value={created.link}
                className="h-12 w-full rounded-xl border border-ink/15 bg-ink/5 px-4 text-ink outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className="h-12 shrink-0 rounded-xl bg-teal-500 px-4 font-semibold text-white transition hover:bg-teal-600"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </label>
          <Button type="button" onClick={() => navigate("/afiliado")}>
            Ir para o painel
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      variant="affiliate"
      title="Seja afiliado/representante"
      subtitle="Indique estabelecimentos e ganhe 25% de cada plano, para sempre."
    >
      {loggedIn && user ? (
        // conta da sessao (Google ou existente): so faltam os dados abaixo
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-teal-500/5 px-4 py-3 ring-1 ring-teal-500/15">
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-ink/60">Cadastrando com a conta</p>
            <p className="truncate font-semibold text-ink">
              {user.name} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="shrink-0 text-sm font-medium text-teal-600 hover:underline"
          >
            Trocar
          </button>
        </div>
      ) : (
        <>
          <GoogleLoginButton
            onSuccess={handleGoogle}
            onError={(msg) => setError(msg)}
          />
          <p className="mt-2 text-center text-xs text-ink/45">
            Com o Google você não precisa criar senha.
          </p>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink/10" />
            <span className="text-xs font-medium uppercase tracking-wide text-ink/40">
              ou com e-mail
            </span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <p className="mb-5 rounded-xl bg-teal-500/5 px-4 py-3 text-sm text-ink/70">
            Já é dono ou funcionário no ServiçosPro? Use o{" "}
            <strong>mesmo e-mail</strong> e a <strong>senha atual</strong> da
            sua conta — ela vira também sua conta de afiliado/representante.
          </p>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!loggedIn && (
          <>
            <Input
              id="name"
              label="Nome completo"
              required
              value={form.name}
              onChange={update("name")}
            />
            <Input
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={update("email")}
            />
            <Input
              id="password"
              label="Senha (a atual, se você já tem conta)"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={update("password")}
            />
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="phone"
            label="Telefone"
            required
            value={form.phone}
            onChange={update("phone")}
          />
          <Input
            id="cpfCnpj"
            label="CPF ou CNPJ"
            required
            value={form.cpfCnpj}
            onChange={update("cpfCnpj")}
          />
        </div>
        <Input
          id="birthDate"
          label="Data de nascimento"
          type="date"
          value={form.birthDate}
          onChange={update("birthDate")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              id="postalCode"
              label="CEP"
              inputMode="numeric"
              required
              value={form.postalCode}
              onChange={update("postalCode")}
              onBlur={onCepBlur}
            />
            {cepHint && <p className="mt-1 text-xs text-red-600">{cepHint}</p>}
          </div>
          <Input
            id="province"
            label="Bairro"
            required
            value={form.province}
            onChange={update("province")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Input
            id="address"
            label="Endereço"
            required
            value={form.address}
            onChange={update("address")}
          />
          <Input
            id="addressNumber"
            label="Número"
            required
            value={form.addressNumber}
            onChange={update("addressNumber")}
          />
        </div>
        <p className="text-xs text-ink/50">
          Seu link de indicação é liberado <strong>na hora</strong>. Guardamos
          esses dados para abrir sua conta de recebimento no Asaas quando o seu{" "}
          <strong>primeiro indicado pagar</strong> — aí você recebe um e-mail do
          Asaas para ativá-la e sacar suas comissões.
        </p>
        {!termsDone && (
          <TermsCheckbox checked={acceptTerms} onChange={setAcceptTerms} />
        )}
        <FieldError>{error}</FieldError>
        <Button type="submit" loading={loading}>
          Criar conta de afiliado
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        Já é afiliado/representante?{" "}
        <Link to="/afiliado/login" className="font-semibold text-teal-500">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
