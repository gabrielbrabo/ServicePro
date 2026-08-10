import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth";
import { PageContainer } from "../components/NavBar";
import { Avatar } from "../components/Avatar";
import { ImageUpload } from "../components/ImageUpload";

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);

  // campos editaveis (inicializados a partir do user atual)
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [country, setCountry] = useState(user?.country || "");
  const [state, setState] = useState(user?.state || "");
  const [city, setCity] = useState(user?.city || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  if (!user) return null;

  const isGoogle = !!user.avatar && user.avatar.includes("googleusercontent");

  const startEdit = () => {
    setName(user.name || "");
    setPhone(user.phone || "");
    setAvatar(user.avatar || "");
    setCountry(user.country || "");
    setState(user.state || "");
    setCity(user.city || "");
    setError(null);
    setSavedMsg(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    if (!name.trim()) {
      setError("O nome não pode ficar vazio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await authApi.updateMe({
        name: name.trim(),
        phone: phone.trim(),
        avatar,
        country: country.trim(),
        state: state.trim(),
        city: city.trim(),
      });
      updateUser(updated);
      setEditing(false);
      setSavedMsg("Perfil atualizado.");
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-display text-2xl font-bold text-ink">
          Meu perfil
        </h1>

        {savedMsg && (
          <div className="mb-4 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
            {savedMsg}
          </div>
        )}

        <div className="rounded-2xl border border-ink/10 bg-white p-6">
          {!editing ? (
            <>
              {/* MODO VISUALIZACAO */}
              <div className="flex items-center gap-4">
                <Avatar name={user.name} src={user.avatar} size={72} />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-xl font-bold text-ink">
                    {user.name}
                  </h2>
                  <p className="truncate text-sm text-ink/60">{user.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {user.emailVerified ? (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">
                        E-mail verificado
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-medium text-amber-600">
                        E-mail não verificado
                      </span>
                    )}
                    {isGoogle && (
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink/50">
                        Conta Google
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                    Telefone
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink/80">
                    {user.phone || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                    Cidade / Estado
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink/80">
                    {[user.city, user.state].filter(Boolean).join(" / ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                    País
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink/80">
                    {user.country || "—"}
                  </dd>
                </div>
              </dl>

              <button
                onClick={startEdit}
                className="mt-6 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                Editar perfil
              </button>
            </>
          ) : (
            <>
              {/* MODO EDICAO */}
              <ImageUpload
                value={avatar}
                onChange={setAvatar}
                folder="usuarios"
                label="Foto de perfil"
                hint="JPG, PNG ou WEBP, até 5 MB."
              />

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink/70">
                    Nome
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink/70">
                    E-mail
                  </label>
                  <input
                    value={user.email}
                    disabled
                    className="w-full cursor-not-allowed rounded-xl border border-ink/10 bg-sand px-3 py-2.5 text-sm text-ink/50"
                  />
                  <p className="mt-1 text-xs text-ink/40">
                    O e-mail não pode ser alterado por aqui.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink/70">
                    Telefone
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink/70">
                      Cidade
                    </label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink/70">
                      Estado
                    </label>
                    <input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink/70">
                      País
                    </label>
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-4 text-sm font-medium text-red-500">{error}</p>
              )}

              <div className="mt-6 flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
                <button
                  onClick={cancel}
                  disabled={saving}
                  className="rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}