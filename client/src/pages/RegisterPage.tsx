import { useState, useEffect, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "./AuthLayout";
import { Button, Input, FieldError } from "../components/ui";
import { AxiosError } from "axios";
import { GoogleLoginButton } from "../components/GoogleLoginButton";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    country: "Brasil",
    state: "",
    city: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 🌍 Load states (IBGE)
  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados")
      .then((res) => res.json())
      .then((data) => {
        const sorted = data.sort((a: any, b: any) =>
          a.nome.localeCompare(b.nome)
        );
        setStates(sorted);
      });
  }, []);

  // 🏙️ Load cities by state
  const loadCities = async (uf: string) => {
    if (!uf) {
      setCities([]);
      return;
    }

    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
    );
    const data = await res.json();

    const sorted = data.sort((a: any, b: any) =>
      a.nome.localeCompare(b.nome)
    );

    setCities(sorted);
  };

  const update =
    (field: keyof typeof form) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("A senha precisa de pelo menos 6 caracteres");
      return;
    }
    if (!form.state || !form.city) {
      setError("Selecione seu estado e cidade");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        country: form.country,
        state: form.state,
        city: form.city,
      });
      navigate("/");
    } catch (err) {
      const ax = err as AxiosError<{ message: string }>;
      setError(ax.response?.data?.message || "Não foi possível criar a conta");
    } finally {
      setLoading(false);
    }
  };

  const selectClass =
    "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60";

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Comece a anunciar ou agendar em minutos."
    >
      <GoogleLoginButton
        onSuccess={() => navigate("/")}
        onError={(msg) => setError(msg)}
      />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink/40">
          ou
        </span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

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
          id="phone"
          label="Telefone (opcional)"
          value={form.phone}
          onChange={update("phone")}
        />

        {/* País (fixo, IBGE só tem Brasil) */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink/70">
            País
          </span>
          <input value={form.country} disabled className={selectClass} />
        </label>

        {/* Estado e cidade (IBGE) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Estado
            </span>
            <select
              value={form.state}
              onChange={(e) => {
                const uf = e.target.value;
                setForm({ ...form, state: uf, city: "" });
                loadCities(uf);
              }}
              className={selectClass}
            >
              <option value="">Selecione o estado</option>
              {states.map((s) => (
                <option key={s.id} value={s.sigla}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Cidade
            </span>
            <select
              value={form.city}
              onChange={update("city")}
              className={selectClass}
              disabled={!form.state}
            >
              <option value="">Selecione a cidade</option>
              {cities.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Input
          id="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={update("password")}
        />
        <FieldError>{error}</FieldError>
        <Button type="submit" loading={loading}>
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink/60">
        Já tem conta?{" "}
        <Link to="/login" className="font-semibold text-teal-500">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}