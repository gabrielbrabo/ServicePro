import { useEffect, useState } from "react";
import {
  beautyApi,
  SterilizationCycle,
  SterilizationIndicator,
} from "../api/beauty";

// Aba "Esterilização" (extra da categoria manicure-pedicure): registro de
// ciclos de autoclave do estabelecimento (biosseguranca / vigilancia
// sanitaria). E do estabelecimento, nao de um cliente.
export function SterilizationManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [cycles, setCycles] = useState<SterilizationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [equipment, setEquipment] = useState("");
  const [load, setLoad] = useState("");
  const [cycle, setCycle] = useState("");
  const [indicator, setIndicator] = useState<SterilizationIndicator>("aprovado");
  const [responsible, setResponsible] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCycles = () => {
    setLoading(true);
    beautyApi
      .listCycles(establishmentId)
      .then(setCycles)
      .catch(() => setError("Não foi possível carregar os ciclos."))
      .finally(() => setLoading(false));
  };

  useEffect(loadCycles, [establishmentId]);

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await beautyApi.addCycle(establishmentId, {
        equipment: equipment.trim(),
        load: load.trim(),
        cycle: cycle.trim(),
        indicator,
        responsible: responsible.trim(),
        notes: notes.trim(),
      });
      setCycles((prev) => [created, ...prev]);
      setEquipment("");
      setLoad("");
      setCycle("");
      setIndicator("aprovado");
      setResponsible("");
      setNotes("");
      setShowForm(false);
    } catch {
      setError("Não foi possível registrar o ciclo.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await beautyApi.removeCycle(establishmentId, id);
      setCycles((prev) => prev.filter((c) => c._id !== id));
    } catch {
      setError("Não foi possível remover o ciclo.");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const authorName = (a: SterilizationCycle["author"]) =>
    typeof a === "object" && a ? a.name : "";

  const indicatorBadge = (i: SterilizationIndicator) => {
    const map: Record<SterilizationIndicator, string> = {
      aprovado: "bg-teal-500/10 text-teal-600",
      reprovado: "bg-red-500/10 text-red-600",
      na: "bg-ink/10 text-ink/50",
    };
    const label: Record<SterilizationIndicator, string> = {
      aprovado: "Indicador aprovado",
      reprovado: "Indicador reprovado",
      na: "Sem indicador",
    };
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[i]}`}
      >
        {label[i]}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">
            Controle de esterilização
          </h2>
          <p className="mt-0.5 text-sm text-ink/50">
            Registro dos ciclos de autoclave — biossegurança e vigilância
            sanitária.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Novo ciclo"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

      {showForm && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Equipamento
              </span>
              <input
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="Ex: Autoclave 01"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Ciclo / parâmetros
              </span>
              <input
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                placeholder="Ex: 134°C por 4 min"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Carga esterilizada
            </span>
            <input
              value={load}
              onChange={(e) => setLoad(e.target.value)}
              placeholder="Ex: 3 conjuntos de alicates, espátulas..."
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Resultado do indicador
              </span>
              <select
                value={indicator}
                onChange={(e) =>
                  setIndicator(e.target.value as SterilizationIndicator)
                }
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                <option value="aprovado">Aprovado</option>
                <option value="reprovado">Reprovado</option>
                <option value="na">Não se aplica</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/70">
                Responsável
              </span>
              <input
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Nome de quem operou"
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">
              Observações
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <button
            onClick={add}
            disabled={saving}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Registrar ciclo"}
          </button>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando ciclos...
          </div>
        ) : cycles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            Nenhum ciclo registrado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {cycles.map((c) => (
              <div
                key={c._id}
                className="rounded-xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">
                        {c.equipment || "Ciclo"}
                        {c.cycle ? ` · ${c.cycle}` : ""}
                      </p>
                      {indicatorBadge(c.indicator)}
                    </div>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {fmtDate(c.date)}
                      {c.responsible ? ` · resp.: ${c.responsible}` : ""}
                      {authorName(c.author)
                        ? ` · registrado por ${authorName(c.author)}`
                        : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(c._id)}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                {c.load && (
                  <p className="mt-2 text-sm text-ink/80">
                    <span className="font-medium text-ink/60">Carga: </span>
                    {c.load}
                  </p>
                )}
                {c.notes && (
                  <p className="mt-1 text-sm text-ink/70">{c.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
