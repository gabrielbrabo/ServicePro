import { useEffect, useState } from "react";
import {
  treatmentPlanApi,
  TreatmentPlan,
} from "../api/treatmentPlan";

const brl = (n: number) =>
  `R$ ${n.toFixed(2).replace(".", ",")}`;

export function TreatmentPlans({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    treatmentPlanApi
      .list(establishmentId, clientId)
      .then(setPlans)
      .catch(() => setError("Não foi possível carregar os planos."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const createPlan = async () => {
    setCreating(true);
    setError(null);
    try {
      const p = await treatmentPlanApi.create(establishmentId, clientId, {});
      setPlans((list) => [p, ...list]);
    } catch {
      setError("Não foi possível criar o plano.");
    } finally {
      setCreating(false);
    }
  };

  const onChanged = (updated: TreatmentPlan) =>
    setPlans((list) => list.map((p) => (p._id === updated._id ? updated : p)));

  const onDeleted = (planId: string) =>
    setPlans((list) => list.filter((p) => p._id !== planId));

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {plans.length} plano{plans.length !== 1 ? "s" : ""} de tratamento
        </p>
        <button
          onClick={createPlan}
          disabled={creating}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {creating ? "Criando..." : "+ Novo plano"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm font-medium text-red-500">{error}</p>
      )}

      <div className="mt-4 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando...
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
            Nenhum plano de tratamento ainda. Crie um para orçar e acompanhar os
            procedimentos.
          </div>
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan._id}
              establishmentId={establishmentId}
              plan={plan}
              onChanged={onChanged}
              onDeleted={onDeleted}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---- Card de um plano ----
function PlanCard({
  establishmentId,
  plan,
  onChanged,
  onDeleted,
}: {
  establishmentId: string;
  plan: TreatmentPlan;
  onChanged: (p: TreatmentPlan) => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState(plan.title);
  const [discount, setDiscount] = useState(String(plan.discount || 0));
  const [installments, setInstallments] = useState(
    String(plan.installments || 1)
  );
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const subtotal = plan.items.reduce((s, i) => s + (i.price || 0), 0);
  const doneValue = plan.items
    .filter((i) => i.done)
    .reduce((s, i) => s + (i.price || 0), 0);
  const total = Math.max(0, subtotal - (plan.discount || 0));
  const pending = Math.max(0, subtotal - doneValue);
  const doneCount = plan.items.filter((i) => i.done).length;
  const parcela = plan.installments > 0 ? total / plan.installments : total;

  const savePlan = async (data: {
    title?: string;
    discount?: number;
    installments?: number;
    status?: TreatmentPlan["status"];
  }) => {
    try {
      const p = await treatmentPlanApi.update(establishmentId, plan._id, data);
      onChanged(p);
    } catch {
      /* silencioso: mantem o valor anterior no proximo carregamento */
    }
  };

  const addItem = async () => {
    if (!newDesc.trim()) return;
    setBusy(true);
    try {
      const p = await treatmentPlanApi.addItem(establishmentId, plan._id, {
        description: newDesc.trim(),
        price: Number(newPrice.replace(",", ".")) || 0,
      });
      onChanged(p);
      setNewDesc("");
      setNewPrice("");
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = async (itemId: string, done: boolean) => {
    const p = await treatmentPlanApi.updateItem(
      establishmentId,
      plan._id,
      itemId,
      { done }
    );
    onChanged(p);
  };

  const removeItem = async (itemId: string) => {
    const p = await treatmentPlanApi.deleteItem(
      establishmentId,
      plan._id,
      itemId
    );
    onChanged(p);
  };

  const removePlan = async () => {
    await treatmentPlanApi.remove(establishmentId, plan._id);
    onDeleted(plan._id);
  };

  const statusColor =
    plan.status === "concluido"
      ? "bg-teal-500/10 text-teal-700"
      : plan.status === "cancelado"
        ? "bg-red-500/10 text-red-600"
        : "bg-amber-400/15 text-amber-700";

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      {/* cabecalho: titulo + status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== plan.title)
              void savePlan({ title: title.trim() });
          }}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 font-display text-lg font-bold text-ink outline-none hover:border-ink/15 focus:border-teal-500"
        />
        <div className="flex items-center gap-2">
          <select
            value={plan.status}
            onChange={(e) =>
              void savePlan({
                status: e.target.value as TreatmentPlan["status"],
              })
            }
            className={`rounded-lg px-2 py-1 text-xs font-semibold outline-none ${statusColor}`}
          >
            <option value="aberto">Aberto</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <button
            onClick={removePlan}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Excluir
          </button>
        </div>
      </div>

      {/* progresso */}
      <p className="mt-1 text-xs text-ink/50">
        {doneCount} de {plan.items.length} procedimento
        {plan.items.length !== 1 ? "s" : ""} concluído
        {doneCount !== 1 ? "s" : ""}
      </p>

      {/* itens */}
      <div className="mt-3 space-y-2">
        {plan.items.map((it) => (
          <div
            key={it._id}
            className="flex items-center gap-3 rounded-xl border border-ink/10 bg-sand/30 p-3"
          >
            <input
              type="checkbox"
              checked={it.done}
              onChange={(e) => void toggleItem(it._id, e.target.checked)}
              className="h-4 w-4 shrink-0 accent-teal-500"
            />
            <span
              className={`min-w-0 flex-1 text-sm ${it.done ? "text-ink/40 line-through" : "text-ink/80"
                }`}
            >
              {it.description}
            </span>
            <span className="shrink-0 text-sm font-semibold text-ink">
              {brl(it.price)}
            </span>
            <button
              onClick={() => void removeItem(it._id)}
              aria-label="Remover procedimento"
              className="shrink-0 text-ink/30 transition hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* adicionar item */}
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Procedimento (ex: Restauração)"
          className="h-10 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
        />
        <input
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          inputMode="decimal"
          placeholder="Valor"
          className="h-10 w-24 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
        />
        <button
          onClick={addItem}
          disabled={busy || !newDesc.trim()}
          className="h-10 rounded-lg bg-teal-500/10 px-4 text-sm font-semibold text-teal-600 transition hover:bg-teal-500/20 disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>

      {/* orcamento: desconto, parcelas e totais */}
      <div className="mt-4 grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Desconto (R$)
          </span>
          <input
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            onBlur={() =>
              void savePlan({
                discount: Number(discount.replace(",", ".")) || 0,
              })
            }
            inputMode="decimal"
            className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Parcelas
          </span>
          <input
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
            onBlur={() =>
              void savePlan({
                installments: Math.max(1, Number(installments) || 1),
              })
            }
            inputMode="numeric"
            className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
      </div>

      <div className="mt-4 space-y-1 rounded-xl bg-sand/50 p-4 text-sm">
        <div className="flex items-center justify-between text-ink/60">
          <span>Subtotal</span>
          <span>{brl(subtotal)}</span>
        </div>
        {plan.discount > 0 && (
          <div className="flex items-center justify-between text-ink/60">
            <span>Desconto</span>
            <span>- {brl(plan.discount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between font-semibold text-ink">
          <span>Total</span>
          <span>{brl(total)}</span>
        </div>
        {plan.installments > 1 && (
          <div className="flex items-center justify-between text-ink/60">
            <span>Parcelas</span>
            <span>
              {plan.installments}x de {brl(parcela)}
            </span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between border-t border-ink/10 pt-1 text-xs">
          <span className="text-teal-700">Feito: {brl(doneValue)}</span>
          <span className="text-amber-700">Pendente: {brl(pending)}</span>
        </div>
      </div>
    </div>
  );
}