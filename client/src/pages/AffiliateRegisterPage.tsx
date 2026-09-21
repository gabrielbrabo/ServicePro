import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button, Input, FieldError } from "../components/ui";
import { AxiosError } from "axios";
import { affiliateApi, Affiliate } from "../api/affiliate";

// Cadastro aberto do afiliado/representante do ServiçosPro. Ao concluir, o
// back abre a conta de recebimento (subconta Asaas) e devolve o link de
// indicação, já com sessão. Quem já é dono/funcionário usa o MESMO e-mail.
export function AffiliateRegisterPage() {
  const navigate = useNavigate();

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

    if (form.password.length < 6) {
      setError("A senha precisa de pelo menos 6 caracteres");
      return;
    }
    if (!form.cpfCnpj || !form.phone) {
      setError("Informe CPF/CNPJ e telefone");
      return;
    }

    // CNPJ (14 dígitos) = pessoa jurídica; senão pessoa física (exige nascimento).
    // O Asaas precisa desses dados para abrir sua conta de recebimento.
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

    setLoading(true);
    try {
      const { token, affiliate } = await affiliateApi.register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        cpfCnpj: form.cpfCnpj,
        birthDate: form.birthDate || undefined,
        postalCode: form.postalCode,
        address: form.address,
        addressNumber: form.addressNumber,
        province: form.province,
      });
      localStorage.setItem("token", token);
      setCreated(affiliate);
    } catch (err) {
      const ax = err as AxiosError<{ message: string }>;
      setError(ax.response?.data?.message || "Não foi possível concluir o cadastro");
    } finally {
      setLoading(false);
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

  if (created) {
    return (
      <AuthLayout
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
          <div className="rounded-xl bg-teal-500/5 p-4 text-sm text-ink/70">
            <p className="font-semibold text-ink">Como você recebe e saca</p>
            <p className="mt-1">
              Sua comissão de {created.commissionPercent}% cai na sua conta de
              recebimento no Asaas a cada pagamento dos seus indicados. Você vai
              receber um <strong>e-mail do Asaas</strong> para ativar seu acesso
              — é por lá que você <strong>saca</strong>. O painel mostra o seu
              saldo e leva direto pra tela de saque do Asaas.
            </p>
          </div>
          <Button type="button" onClick={() => navigate("/afiliado")}>
            Ir para o painel
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Seja afiliado/representante"
      subtitle="Indique estabelecimentos e ganhe 25% de cada plano, para sempre."
    >
      <p className="mb-5 rounded-xl bg-teal-500/5 px-4 py-3 text-sm text-ink/70">
        Já é dono ou funcionário no ServiçosPro? Use o{" "}
        <strong>mesmo e-mail</strong> e a <strong>senha atual</strong> da sua
        conta — ela vira também sua conta de afiliado/representante.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <Input
            id="postalCode"
            label="CEP"
            required
            value={form.postalCode}
            onChange={update("postalCode")}
          />
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
          Com esses dados abrimos sua conta de recebimento no Asaas (por isso a
          data de nascimento e o endereço são obrigatórios). Você vai receber um{" "}
          <strong>e-mail do Asaas</strong> para ativar o acesso — é por lá que
          você saca suas comissões.
        </p>
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
