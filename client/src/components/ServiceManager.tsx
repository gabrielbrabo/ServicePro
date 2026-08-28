import { useEffect, useMemo, useState, FormEvent } from "react";
import {
  catalogApi,
  Category,
  Service,
  ProfessionalDuration,
} from "../api/catalog";
import { professionalApi, Professional } from "../api/professional";
import { formatPrice } from "../lib/time";
import { computeServicesWithoutPro } from "../lib/coverage";

// converte {proId: "40"} -> [{ professional, durationMinutes }], ignorando vazios
function durationsToPayload(
  rec: Record<string, string>
): ProfessionalDuration[] {
  return Object.entries(rec)
    .map(([professional, v]) => ({
      professional,
      durationMinutes: Math.floor(Number(v)),
    }))
    .filter((d) => d.durationMinutes > 0);
}

// converte [{professional, durationMinutes}] -> {proId: "40"} para os inputs
function durationsToRecord(
  list?: ProfessionalDuration[]
): Record<string, string> {
  const rec: Record<string, string> = {};
  (list || []).forEach((d) => {
    rec[d.professional] = String(d.durationMinutes);
  });
  return rec;
}

// override de taxa: vazio => null (usa o padrao do estabelecimento)
function feeOrNull(v: string): number | null {
  return v.trim() === "" ? null : Math.max(0, Number(v) || 0);
}

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
    bufferMinutes: "0",
    processingGapAfter: "0",
    processingGapMinutes: "0",
    depositType: "none",
    depositValue: "",
    serviceMode: "local",
    homeBaseFee: "",
    homeFeePerKm: "",
    category: "",
  });
  // profissionais marcados no form de criacao (ids). vazio = todos fazem.
  const [formPros, setFormPros] = useState<string[]>([]);
  // duracao por profissional no form de criacao: {proId: "40"}. vazio = padrao.
  const [formDurations, setFormDurations] = useState<Record<string, string>>(
    {}
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // edicao de "quem faz" inline no card: id do servico em edicao + selecao
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPros, setEditPros] = useState<string[]>([]);
  const [editBuffer, setEditBuffer] = useState("0");
  const [editGapAfter, setEditGapAfter] = useState("0");
  const [editGapMinutes, setEditGapMinutes] = useState("0");
  const [editDepositType, setEditDepositType] = useState("none");
  const [editDepositValue, setEditDepositValue] = useState("");
  const [editServiceMode, setEditServiceMode] = useState("local");
  const [editHomeBaseFee, setEditHomeBaseFee] = useState("");
  const [editHomeFeePerKm, setEditHomeFeePerKm] = useState("");
  const [editDurations, setEditDurations] = useState<Record<string, string>>(
    {}
  );
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
        bufferMinutes: Math.max(0, Number(form.bufferMinutes) || 0),
        processingGapAfter: Math.max(0, Number(form.processingGapAfter) || 0),
        processingGapMinutes: Math.max(
          0,
          Number(form.processingGapMinutes) || 0
        ),
        depositType: form.depositType as "none" | "percent" | "fixed",
        depositValue:
          form.depositType === "none"
            ? 0
            : Math.max(0, Number(form.depositValue) || 0),
        serviceMode: form.serviceMode as "local" | "domicilio" | "ambos",
        homeBaseFee:
          form.serviceMode === "local" ? null : feeOrNull(form.homeBaseFee),
        homeFeePerKm:
          form.serviceMode === "local" ? null : feeOrNull(form.homeFeePerKm),
        category: form.category,
        professionals: formPros, // [] = todos fazem
        professionalDurations: durationsToPayload(formDurations),
      });
      setForm({
        title: "",
        description: "",
        price: "",
        durationMinutes: "30",
        bufferMinutes: "0",
        processingGapAfter: "0",
        processingGapMinutes: "0",
        depositType: "none",
        depositValue: "",
        serviceMode: "local",
        homeBaseFee: "",
        homeFeePerKm: "",
        category: categories[0]?._id || "",
      });
      setFormPros([]);
      setFormDurations({});
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
    setEditBuffer(String(s.bufferMinutes ?? 0));
    setEditGapAfter(String(s.processingGapAfter ?? 0));
    setEditGapMinutes(String(s.processingGapMinutes ?? 0));
    setEditDepositType(s.depositType ?? "none");
    setEditDepositValue(
      s.depositType && s.depositType !== "none" ? String(s.depositValue ?? "") : ""
    );
    setEditServiceMode(s.serviceMode ?? "local");
    setEditHomeBaseFee(
      s.homeBaseFee === null || s.homeBaseFee === undefined
        ? ""
        : String(s.homeBaseFee)
    );
    setEditHomeFeePerKm(
      s.homeFeePerKm === null || s.homeFeePerKm === undefined
        ? ""
        : String(s.homeFeePerKm)
    );
    setEditDurations(durationsToRecord(s.professionalDurations));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPros([]);
    setEditBuffer("0");
    setEditGapAfter("0");
    setEditGapMinutes("0");
    setEditDepositType("none");
    setEditDepositValue("");
    setEditServiceMode("local");
    setEditHomeBaseFee("");
    setEditHomeFeePerKm("");
    setEditDurations({});
  };

  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const updated = await catalogApi.updateService(id, {
        professionals: editPros,
        bufferMinutes: Math.max(0, Number(editBuffer) || 0),
        processingGapAfter: Math.max(0, Number(editGapAfter) || 0),
        processingGapMinutes: Math.max(0, Number(editGapMinutes) || 0),
        depositType: editDepositType as "none" | "percent" | "fixed",
        depositValue:
          editDepositType === "none"
            ? 0
            : Math.max(0, Number(editDepositValue) || 0),
        serviceMode: editServiceMode as "local" | "domicilio" | "ambos",
        homeBaseFee:
          editServiceMode === "local" ? null : feeOrNull(editHomeBaseFee),
        homeFeePerKm:
          editServiceMode === "local" ? null : feeOrNull(editHomeFeePerKm),
        professionalDurations: durationsToPayload(editDurations),
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
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Folga após (min)
              </span>
              <input
                type="number"
                min="0"
                value={form.bufferMinutes}
                onChange={(e) =>
                  setForm({ ...form, bufferMinutes: e.target.value })
                }
                placeholder="0"
                className="h-11 w-full rounded-xl border border-ink/15 px-3 outline-none focus:border-teal-500"
              />
              <span className="mt-1 block text-xs text-ink/40">
                Tempo de preparo/limpeza após o atendimento.
              </span>
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

          {/* Pausa de processamento (química/espera) */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              Pausa de processamento (opcional)
            </span>
            <p className="mb-2 text-xs text-ink/50">
              Para serviços com tempo de espera (química, tintura, etc.). Durante
              a pausa o profissional fica livre para atender outro cliente. A
              duração acima é o tempo TOTAL (trabalho + pausa).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink/70">
                  Trabalho até a pausa (min)
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.processingGapAfter}
                  onChange={(e) =>
                    setForm({ ...form, processingGapAfter: e.target.value })
                  }
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-ink/15 px-2 outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink/70">
                  Duração da pausa (min)
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.processingGapMinutes}
                  onChange={(e) =>
                    setForm({ ...form, processingGapMinutes: e.target.value })
                  }
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-ink/15 px-2 outline-none focus:border-teal-500"
                />
              </label>
            </div>
          </div>

          {/* Sinal / pré-pagamento (opcional) */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              Sinal / pré-pagamento (opcional)
            </span>
            <p className="mb-2 text-xs text-ink/50">
              Exige um valor adiantado ao agendar, para reduzir faltas. O
              recebimento é registrado manualmente na agenda.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink/70">
                  Tipo
                </span>
                <select
                  value={form.depositType}
                  onChange={(e) =>
                    setForm({ ...form, depositType: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                >
                  <option value="none">Sem sinal</option>
                  <option value="percent">Porcentagem (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </label>
              {form.depositType !== "none" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    {form.depositType === "percent"
                      ? "% do preço"
                      : "Valor (R$)"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step={form.depositType === "percent" ? "1" : "0.01"}
                    value={form.depositValue}
                    onChange={(e) =>
                      setForm({ ...form, depositValue: e.target.value })
                    }
                    placeholder={form.depositType === "percent" ? "30" : "20"}
                    className="h-10 w-full rounded-lg border border-ink/15 px-2 outline-none focus:border-teal-500"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Atendimento a domicílio */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              Atendimento a domicílio
            </span>
            <p className="mb-2 text-xs text-ink/50">
              O deslocamento (ida e volta) é reservado na agenda
              automaticamente. A taxa usa o padrão do estabelecimento; preencha
              abaixo só para sobrescrever neste serviço.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink/70">
                  Onde atende
                </span>
                <select
                  value={form.serviceMode}
                  onChange={(e) =>
                    setForm({ ...form, serviceMode: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                >
                  <option value="local">No estabelecimento</option>
                  <option value="domicilio">Só a domicílio</option>
                  <option value="ambos">Ambos</option>
                </select>
              </label>
              {form.serviceMode !== "local" && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink/70">
                      Taxa fixa (R$)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.homeBaseFee}
                      onChange={(e) =>
                        setForm({ ...form, homeBaseFee: e.target.value })
                      }
                      placeholder="padrão"
                      className="h-10 w-full rounded-lg border border-ink/15 px-2 outline-none focus:border-teal-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink/70">
                      Taxa por km (R$)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.homeFeePerKm}
                      onChange={(e) =>
                        setForm({ ...form, homeFeePerKm: e.target.value })
                      }
                      placeholder="padrão"
                      className="h-10 w-full rounded-lg border border-ink/15 px-2 outline-none focus:border-teal-500"
                    />
                  </label>
                </>
              )}
            </div>
          </div>

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

          {/* Duração por profissional (opcional) */}
          {hasTeam && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Duração por profissional (opcional)
              </span>
              <p className="mb-2 text-xs text-ink/50">
                Deixe em branco para usar a duração padrão do serviço.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {professionals.map((p) => (
                  <label key={p._id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink/70">
                      {p.name}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={formDurations[p._id] || ""}
                      onChange={(e) =>
                        setFormDurations((r) => ({
                          ...r,
                          [p._id]: e.target.value,
                        }))
                      }
                      placeholder="padrão"
                      className="h-10 w-24 rounded-lg border border-ink/15 px-2 text-right text-sm outline-none focus:border-teal-500"
                    />
                    <span className="text-xs text-ink/40">min</span>
                  </label>
                ))}
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

                    <div className="mt-3">
                      <span className="mb-1 block text-xs font-medium text-ink/70">
                        Folga após (min)
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
                        className="h-9 w-24 rounded-lg border border-ink/15 px-2 text-right text-sm outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="mt-3">
                      <span className="mb-1 block text-xs font-medium text-ink/70">
                        Pausa de processamento (opcional)
                      </span>
                      <p className="mb-1.5 text-xs text-ink/40">
                        Durante a pausa o profissional fica livre. A duração do
                        serviço é o tempo total (trabalho + pausa).
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2">
                          <span className="text-xs text-ink/70">
                            Trabalho até a pausa
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={editGapAfter}
                            onChange={(e) => setEditGapAfter(e.target.value)}
                            className="h-9 w-20 rounded-lg border border-ink/15 px-2 text-right text-sm outline-none focus:border-teal-500"
                          />
                          <span className="text-xs text-ink/40">min</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <span className="text-xs text-ink/70">
                            Duração da pausa
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={editGapMinutes}
                            onChange={(e) => setEditGapMinutes(e.target.value)}
                            className="h-9 w-20 rounded-lg border border-ink/15 px-2 text-right text-sm outline-none focus:border-teal-500"
                          />
                          <span className="text-xs text-ink/40">min</span>
                        </label>
                      </div>
                    </div>

                    <div className="mt-3">
                      <span className="mb-1 block text-xs font-medium text-ink/70">
                        Sinal / pré-pagamento (opcional)
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={editDepositType}
                          onChange={(e) => setEditDepositType(e.target.value)}
                          className="h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                        >
                          <option value="none">Sem sinal</option>
                          <option value="percent">Porcentagem (%)</option>
                          <option value="fixed">Valor fixo (R$)</option>
                        </select>
                        {editDepositType !== "none" && (
                          <label className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step={editDepositType === "percent" ? "1" : "0.01"}
                              value={editDepositValue}
                              onChange={(e) =>
                                setEditDepositValue(e.target.value)
                              }
                              placeholder={
                                editDepositType === "percent" ? "30" : "20"
                              }
                              className="h-9 w-24 rounded-lg border border-ink/15 px-2 text-right text-sm outline-none focus:border-teal-500"
                            />
                            <span className="text-xs text-ink/40">
                              {editDepositType === "percent" ? "%" : "R$"}
                            </span>
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <span className="mb-1 block text-xs font-medium text-ink/70">
                        Atendimento a domicílio
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={editServiceMode}
                          onChange={(e) => setEditServiceMode(e.target.value)}
                          className="h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                        >
                          <option value="local">No estabelecimento</option>
                          <option value="domicilio">Só a domicílio</option>
                          <option value="ambos">Ambos</option>
                        </select>
                        {editServiceMode !== "local" && (
                          <>
                            <label className="flex items-center gap-1.5">
                              <span className="text-xs text-ink/70">
                                Taxa fixa
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editHomeBaseFee}
                                onChange={(e) =>
                                  setEditHomeBaseFee(e.target.value)
                                }
                                placeholder="padrão"
                                className="h-9 w-20 rounded-lg border border-ink/15 px-2 text-right text-sm outline-none focus:border-teal-500"
                              />
                              <span className="text-xs text-ink/40">R$</span>
                            </label>
                            <label className="flex items-center gap-1.5">
                              <span className="text-xs text-ink/70">/km</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editHomeFeePerKm}
                                onChange={(e) =>
                                  setEditHomeFeePerKm(e.target.value)
                                }
                                placeholder="padrão"
                                className="h-9 w-20 rounded-lg border border-ink/15 px-2 text-right text-sm outline-none focus:border-teal-500"
                              />
                              <span className="text-xs text-ink/40">R$</span>
                            </label>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <span className="mb-1 block text-xs font-medium text-ink/70">
                        Duração por profissional (opcional)
                      </span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {professionals.map((p) => (
                          <label
                            key={p._id}
                            className="flex items-center gap-2"
                          >
                            <span className="min-w-0 flex-1 truncate text-xs text-ink/70">
                              {p.name}
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={editDurations[p._id] || ""}
                              onChange={(e) =>
                                setEditDurations((r) => ({
                                  ...r,
                                  [p._id]: e.target.value,
                                }))
                              }
                              placeholder="padrão"
                              className="h-9 w-20 rounded-lg border border-ink/15 px-2 text-right text-sm outline-none focus:border-teal-500"
                            />
                            <span className="text-xs text-ink/40">min</span>
                          </label>
                        ))}
                      </div>
                    </div>

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