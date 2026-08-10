import { useEffect, useState, useCallback } from "react";
import { stockApi, StockMovement, StockMovementType } from "../api/stock";
import { Product } from "../api/product";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const TYPE_LABEL: Record<StockMovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  inventario: "Inventário",
};

const TYPE_STYLE: Record<StockMovementType, string> = {
  entrada: "bg-teal-50 text-teal-700",
  saida: "bg-red-50 text-red-600",
  inventario: "bg-amber-400/20 text-amber-700",
};

const personName = (v: unknown): string =>
  typeof v === "object" && v !== null && "name" in (v as object)
    ? String((v as { name: string }).name)
    : "";

export function StockMovementModal({
  establishmentId,
  product,
  onClose,
  onUpdated,
}: {
  establishmentId: string;
  product: Product;
  onClose: () => void;
  onUpdated: (p: Product) => void;
}) {
  const [current, setCurrent] = useState<Product>(product);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [type, setType] = useState<StockMovementType>("entrada");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    stockApi
      .byProduct(establishmentId, product._id)
      .then(setMovements)
      .catch(() => {
        /* histórico é secundário */
      })
      .finally(() => setLoadingHistory(false));
  }, [establishmentId, product._id]);

  useEffect(loadHistory, [loadHistory]);

  // prévia do saldo resultante
  const qty = Number(quantity);
  const preview =
    quantity !== "" && Number.isFinite(qty)
      ? type === "entrada"
        ? current.stock + qty
        : type === "saida"
        ? current.stock - qty
        : qty
      : null;

  const submit = async () => {
    setError(null);
    setWarnings([]);

    if (quantity === "" || !Number.isFinite(qty) || qty < 0) {
      setError("Informe uma quantidade válida.");
      return;
    }
    if (type !== "inventario" && qty === 0) {
      setError("A quantidade deve ser maior que zero.");
      return;
    }

    setSaving(true);
    try {
      const res = await stockApi.create(establishmentId, product._id, {
        type,
        quantity: qty,
        reason: reason.trim() || undefined,
        unitCost: unitCost ? Number(unitCost) : undefined,
      });

      setCurrent(res.product);
      onUpdated(res.product);
      setWarnings(res.warnings || []);
      setMovements((list) => [res.movement, ...list]);

      // limpa o formulário
      setQuantity("");
      setReason("");
      setUnitCost("");
    } catch {
      setError("Não foi possível registrar a movimentação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 p-5">
          <div className="flex items-center gap-3">
            {current.photo ? (
              <img
                src={current.photo}
                alt={current.name}
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sand text-xl text-ink/30">
                📦
              </div>
            )}
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                {current.name}
              </h2>
              <p className="text-sm text-ink/60">
                Estoque atual:{" "}
                <strong
                  className={
                    current.stock < 0
                      ? "text-red-600"
                      : current.minStock > 0 && current.stock <= current.minStock
                      ? "text-amber-700"
                      : "text-ink"
                  }
                >
                  {current.stock}
                </strong>
                {current.minStock > 0 && (
                  <span className="text-ink/40">
                    {" "}
                    · mínimo {current.minStock}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Formulário de movimentação */}
          <div className="rounded-xl bg-sand/40 p-4">
            <p className="mb-2 text-sm font-medium text-ink/70">
              Nova movimentação
            </p>

            <div className="flex flex-wrap gap-2">
              {(["entrada", "saida", "inventario"] as StockMovementType[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      type === t
                        ? "border-teal-500 bg-teal-500 text-white"
                        : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                    }`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                )
              )}
            </div>

            <p className="mt-2 text-xs text-ink/50">
              {type === "entrada" &&
                "Compra ou reposição: soma ao estoque atual."}
              {type === "saida" &&
                "Venda manual, perda ou uso interno: subtrai do estoque."}
              {type === "inventario" &&
                "Contagem física: define o estoque com o valor informado."}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  {type === "inventario"
                    ? "Quantidade contada"
                    : "Quantidade"}
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              {type === "entrada" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink/70">
                    Custo unitário (R$)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="Opcional"
                    className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                  />
                </label>
              )}

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Motivo (opcional)
                </span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: compra fornecedor, produto vencido, contagem mensal"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
            </div>

            {preview !== null && (
              <p
                className={`mt-3 text-sm font-medium ${
                  preview < 0 ? "text-red-600" : "text-ink/70"
                }`}
              >
                Estoque ficará em <strong>{preview}</strong>
                {preview < 0 && " (negativo)"}
              </p>
            )}

            {error && (
              <p className="mt-2 text-sm font-medium text-red-500">{error}</p>
            )}

            {warnings.length > 0 && (
              <div className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2">
                {warnings.map((w, i) => (
                  <p key={i} className="text-sm font-medium text-amber-800">
                    ⚠ {w}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={submit}
              disabled={saving}
              className="mt-4 h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Registrando..." : "Registrar movimentação"}
            </button>
          </div>

          {/* Histórico */}
          <div className="mt-6">
            <h3 className="mb-3 font-display font-bold text-ink">
              Histórico de movimentações
            </h3>

            {loadingHistory ? (
              <p className="text-ink/50">Carregando...</p>
            ) : movements.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
                Nenhuma movimentação registrada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {movements.map((m) => (
                  <div
                    key={m._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLE[m.type]}`}
                      >
                        {TYPE_LABEL[m.type]}
                      </span>
                      <div>
                        <p className="text-sm text-ink">
                          {m.type === "inventario"
                            ? `Ajuste para ${m.quantity}`
                            : `${m.type === "entrada" ? "+" : "−"} ${m.quantity}`}
                          <span className="text-ink/50">
                            {" "}
                            · {m.stockBefore} → {m.stockAfter}
                          </span>
                        </p>
                        <p className="text-xs text-ink/50">
                          {fmtDateTime(m.createdAt)}
                          {personName(m.createdBy)
                            ? ` · ${personName(m.createdBy)}`
                            : ""}
                          {m.reason ? ` · ${m.reason}` : ""}
                        </p>
                      </div>
                    </div>
                    {m.unitCost > 0 && (
                      <span className="text-xs text-ink/40">
                        custo {BRL(m.unitCost)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}