import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "../components/NavBar";
import { establishmentApi, Establishment } from "../api/establishment";
import { AddressAutocomplete, ResolvedAddress } from "../components/AddressAutocomplete";
import { useEstablishments } from "../context/EstablishmentContext";

export function EstablishmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refresh } = useEstablishments();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    country: "Brasil",
    state: "",
    city: "",
    neighborhood: "",
    street: "",
    number: "",
  });
  // coordenadas: null = nao mexeu; preenchido = novo endereco escolhido
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const inputClass =
    "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

  // carrega o estabelecimento
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    establishmentApi
      .getById(id)
      .then((est: Establishment) => {
        setForm({
          name: est.name || "",
          description: est.description || "",
          phone: est.phone || "",
          country: est.address?.country || "Brasil",
          state: est.address?.state || "",
          city: est.address?.city || "",
          neighborhood: est.address?.neighborhood || "",
          street: est.address?.street || "",
          number: est.address?.number || "",
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const update =
    (field: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm({ ...form, [field]: e.target.value });
    };

  // ao escolher um endereco no autocomplete, preenche os campos + coordenadas
  const applyResolved = (addr: ResolvedAddress) => {
    setForm((f) => ({
      ...f,
      country: addr.country || "Brasil",
      state: addr.state,
      city: addr.city,
      neighborhood: addr.neighborhood,
      street: addr.street,
      number: addr.number || f.number,
    }));
    setCoords({ lat: addr.lat, lon: addr.lon });
    setError("");
  };

  const save = async () => {
    if (!id) return;
    setError("");
    setSavedMsg("");

    if (!form.name.trim()) {
      setError("O nome não pode ficar vazio.");
      return;
    }
    if (
      !form.country ||
      !form.state ||
      !form.city ||
      !form.neighborhood ||
      !form.street ||
      !form.number
    ) {
      setError("Preencha o endereço completo (use a busca para facilitar).");
      return;
    }

    setSaving(true);
    try {
      await establishmentApi.update(id, {
        name: form.name.trim(),
        description: form.description.trim(),
        phone: form.phone.trim(),
        address: {
          country: form.country,
          state: form.state,
          city: form.city,
          neighborhood: form.neighborhood,
          street: form.street,
          number: form.number,
        },
        // so envia coordenadas se o usuario escolheu um novo endereco
        ...(coords
          ? {
              location: {
                type: "Point",
                coordinates: [coords.lon, coords.lat] as [number, number],
              },
            }
          : {}),
      });
      // atualiza a lista/estado do painel
      refresh();
      setSavedMsg("Alterações salvas.");
      // volta ao painel apos um instante
      setTimeout(() => navigate("/painel"), 700);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <p className="text-ink/50">Carregando...</p>
      </PageContainer>
    );
  }

  if (notFound) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-lg rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <p className="text-ink/60">Estabelecimento não encontrado.</p>
          <button
            onClick={() => navigate("/painel")}
            className="mt-4 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Voltar ao painel
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate("/painel")}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
          >
            ← Voltar
          </button>
          <h1 className="font-display text-2xl font-bold text-ink">
            Editar estabelecimento
          </h1>
        </div>

        {savedMsg && (
          <div className="mb-4 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
            {savedMsg}
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-6">
          {/* Nome */}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Nome do negócio
            </span>
            <input
              value={form.name}
              onChange={update("name")}
              className={inputClass}
            />
          </label>

          {/* Telefone */}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Telefone
            </span>
            <input
              value={form.phone}
              onChange={update("phone")}
              placeholder="(38) 99999-0000"
              className={inputClass}
            />
          </label>

          {/* Descrição */}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Descrição
            </span>
            <textarea
              value={form.description}
              onChange={update("description")}
              rows={3}
              className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal-500"
            />
          </label>

          {/* Endereço */}
          <div className="rounded-xl border border-ink/10 bg-sand/50 p-4">
            <p className="mb-1 text-sm font-semibold text-ink/70">Endereço</p>
            <p className="mb-3 text-xs text-ink/50">
              Endereço atual:{" "}
              {[form.street, form.number, form.neighborhood, form.city, form.state]
                .filter(Boolean)
                .join(", ") || "não informado"}
            </p>

            <AddressAutocomplete
              onResolved={applyResolved}
              label="Buscar novo endereço"
              hint="Digite e escolha na lista para atualizar o endereço e a localização no mapa."
            />

            {coords && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-600">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Nova localização confirmada no mapa
              </p>
            )}

            {/* campos editaveis para ajuste fino */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Rua
                </span>
                <input
                  value={form.street}
                  onChange={update("street")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Número
                </span>
                <input
                  value={form.number}
                  onChange={update("number")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Bairro
                </span>
                <input
                  value={form.neighborhood}
                  onChange={update("neighborhood")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Cidade
                </span>
                <input
                  value={form.city}
                  onChange={update("city")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  Estado (UF)
                </span>
                <input
                  value={form.state}
                  onChange={update("state")}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">
                  País
                </span>
                <input
                  value={form.country}
                  onChange={update("country")}
                  className={inputClass}
                  disabled
                />
              </label>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              onClick={() => navigate("/painel")}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}