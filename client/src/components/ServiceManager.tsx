import { useEffect, useMemo, useState, FormEvent } from "react";
import { catalogApi, Category, Service } from "../api/catalog";
import { professionalApi, Professional } from "../api/professional";
import { formatPrice } from "../lib/time";
import { computeServicesWithoutPro } from "../lib/coverage";

// Gerencia os servicos de UM estabelecimento.
// myProfessionalId != null => modo funcionario: ve apenas os servicos que ele
// presta, sem criar/editar/remover.
export function ServiceManager({
  establishmentId,
  myProfessionalId = null,
}: {
  establishmentId: string;
  myProfessionalId?: string | null;
}) {
  const isEmployee = !!myProfessionalId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    durationMinutes: "30",
    category: "",
  });
  // profissionais marcados no form de criacao (ids). vazio = todos fazem.
  const [formPros, setFormPros] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // edicao de "quem faz" inline no card: id do servico em edicao + selecao
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPros, setEditPros] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const hasTeam = professionals.length > 0;

  // servicos que ninguem ativo realiza (aviso). so faz sentido para o dono.
  const uncovered = useMemo(
    () => computeServicesWithoutPro(services, professionals),
    [services, professionals]
  );

  const load = () => {
    catalogApi.byEstablishment(establishmentId).then((all) => {
      // funcionario ve apenas os servicos que ELE presta:
      // - lista de profissionais do servico contem o id dele, OU
      // - servico sem ninguem marcado (todos fazem)
      if (isEmployee) {
        const mine = all.filter((s) => {
          const ids = s.professionals ?? [];
          return ids.length === 0 || ids.includes(myProfessionalId);
        });
        setServices(mine);
      } else {
        setServices(all);
      }
    });
  };

  useEffect(() => {
    catalogApi.categories().then((c) => {
      setCategories(c);
      setForm((f) => ({ ...f, category: c[0]?._id || "" }));
    });
  }, []);

  useEffect(() => {
    load();
    // busca a equipe ativa para montar os seletores / mostrar nomes
    professionalApi
      .list(establishmentId)
      .then(setProfessionals)
      .catch(() => setProfessionals([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId]);

  // helpers de toggle de profissional numa lista de ids
  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title || !form.price || !form.category) {
      setError("Preencha título, preço e categoria");
      return;
    }
    setSaving(true);
    try {
      await catalogApi.createService({
        establishment: establishmentId,
        title: form.title,
        description: form.description,
        price: Number(form.price),
        durationMinutes: Number(form.durationMinutes),
        category: form.category,
        professionals: formPros, // [] = todos fazem
      });
      setForm({
        title: "",
        description: "",
        price: "",
        durationMinutes: "30",
        category: categories[0]?._id || "",
      });
      setFormPros([]);
      setShowForm(false);
      load();
    } catch {
      setError("Não foi possível criar o serviço");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await catalogApi.deleteService(id);
    setServices((s) => s.filter((x) => x._id !== id));
  };

  // abre o editor de "quem faz" para um servico
  const startEdit = (s: Service) => {
    setEditingId(s._id);
    setEditPros(s.professionals ?? []);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPros([]);
  };

  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const updated = await catalogApi.updateService(id, {
        professionals: editPros,
      });
      setServices((list) => list.map((x) => (x._id === id ? updated : x)));
      cancelEdit();
    } catch {
      setError("Não foi possível salvar quem faz o serviço.");
    } finally {
      setSavingEdit(false);
    }
  };

  // dado um servico, retorna os nomes de quem faz (ou "Todos")
  const whoDoes = (s: Service): string => {
    const ids = s.professionals ?? [];
    if (!hasTeam || ids.length === 0) return "Todos";
    const names = professionals
      .filter((p) => ids.includes(p._id))
      .map((p) => p.name);
    return names.length > 0 ? names.join(" · ") : "Todos";
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {isEmployee
            ? `${services.length} serviço${
                services.length !== 1 ? "s" : ""
              } que você presta`
            : `${services.length} serviço${
                services.length !== 1 ? "s" : ""
              } cadastrado${services.length !== 1 ? "s" : ""}`}
        </p>
        {/* botao de criar: so o dono */}
        {!isEmployee && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            {showForm ? "Cancelar" : "+ Novo serviço"}
          </button>
        )}
      </div>

      {showForm && !isEmployee && (
        <form
          onSubmit={submit}
          className="mb-6 space-y-3 rounded-2xl border border-ink/10 bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Serviço
              </span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Corte masculino"
                className="h-11 w-full rounded-xl border border-ink/15 px-3 outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Preço (R$)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="50"
                className="h-11 w-full rounded-xl border border-ink/15 px-3 outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Duração (minutos)
              </span>
              <select
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({ ...form, durationMinutes: e.target.value })
                }
                className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500"
              >
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              Descrição
            </span>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              placeholder="Detalhe o que está incluído"
              className="w-full rounded-xl border border-ink/15 px-3 py-2 outline-none focus:border-teal-500"
            />
          </label>

          {/* Quem faz este serviço (só quando há equipe) */}
          {hasTeam && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Quem faz este serviço
              </span>
              <p className="mb-2 text-xs text-ink/50">
                Não marque ninguém para que todos os profissionais possam fazer.
              </p>
              <div className="flex flex-wrap gap-2">
                {professionals.map((p) => {
                  const on = formPros.includes(p._id);
                  return (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => setFormPros((l) => toggleIn(l, p._id))}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        on
                          ? "border-teal-500 bg-teal-500 text-white"
                          : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar serviço"}
          </button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <div
            key={s._id}
            className="rounded-2xl border border-ink/10 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-display font-bold text-ink">{s.title}</h4>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">
                {s.durationMinutes} min
              </span>
            </div>
            {s.description && (
              <p className="mt-1 line-clamp-2 text-sm text-ink/60">
                {s.description}
              </p>
            )}

            {/* aviso: nenhum profissional realiza este servico */}
            {!isEmployee && uncovered.has(s._id) && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                <span aria-hidden="true">⚠️</span>
                <span>
                  Nenhum profissional realiza este serviço — ninguém receberá
                  agendamentos dele. Defina em "Quem faz".
                </span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between">
              <p className="font-semibold text-teal-600">
                {formatPrice(s.price)}
              </p>
              {/* remover: so o dono */}
              {!isEmployee && (
                <button
                  onClick={() => remove(s._id)}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Remover
                </button>
              )}
            </div>

            {/* Quem faz — só quando há equipe. Edicao: so o dono. */}
            {hasTeam && (
              <div className="mt-3 border-t border-ink/10 pt-3">
                {editingId === s._id && !isEmployee ? (
                  <div>
                    <span className="mb-2 block text-xs font-medium text-ink/70">
                      Quem faz este serviço
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {professionals.map((p) => {
                        const on = editPros.includes(p._id);
                        return (
                          <button
                            key={p._id}
                            type="button"
                            onClick={() =>
                              setEditPros((l) => toggleIn(l, p._id))
                            }
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                              on
                                ? "border-teal-500 bg-teal-500 text-white"
                                : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-xs text-ink/40">
                      Ninguém marcado = todos fazem.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(s._id)}
                        disabled={savingEdit}
                        className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
                      >
                        {savingEdit ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-sand"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-ink/60">
                      <span className="font-medium text-ink/70">Quem faz:</span>{" "}
                      {whoDoes(s)}
                    </p>
                    {/* editar: so o dono */}
                    {!isEmployee && (
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="shrink-0 text-xs font-medium text-teal-600 hover:underline"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {services.length === 0 && !showForm && (
          <div className="col-span-full rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
            {isEmployee
              ? "Você ainda não está associado a nenhum serviço. Peça ao dono para incluir você."
              : "Este estabelecimento ainda não tem serviços. Crie o primeiro para abrir a agenda."}
          </div>
        )}
      </div>
    </div>
  );
}