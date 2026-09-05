import { useEffect, useMemo, useState } from "react";
import { cashApi, PaymentMethod, SaleItemInput, CashPayment } from "../api/cash";
import { Product } from "../api/product";
import { catalogApi, Service } from "../api/catalog";
import { professionalApi, Professional } from "../api/professional";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const METHODS: [PaymentMethod, string][] = [
  ["dinheiro", "Dinheiro"],
  ["cartao", "Cartão"],
  ["pix", "Pix"],
  ["outro", "Outro"],
];

type CartLine = {
  key: string;
  kind: "servico" | "produto" | "avulso";
  refId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  maxStock?: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
let seq = 0;
const newKey = () => `l${Date.now()}_${seq++}`;

export function NewSaleModal({
  establishmentId,
  products,
  onClose,
  onDone,
}: {
  establishmentId: string;
  products: Product[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clients, setClients] = useState<EstablishmentClient[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickKind, setPickKind] = useState<"servico" | "produto" | "avulso">(
    "servico"
  );
  const [search, setSearch] = useState("");

  // avulso
  const [avName, setAvName] = useState("");
  const [avPrice, setAvPrice] = useState("");

  const [discount, setDiscount] = useState("");
  const [fee, setFee] = useState("");

  const [professionalId, setProfessionalId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [showClientList, setShowClientList] = useState(false);

  const [fiado, setFiado] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const [split, setSplit] = useState(false);
  const [parts, setParts] = useState<CashPayment[]>([
    { method: "dinheiro", amount: 0 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalogApi
      .byEstablishment(establishmentId)
      .then((s) => setServices(s.filter((x) => x.active && x.kind !== "aula")))
      .catch(() => setServices([]));
    professionalApi
      .list(establishmentId)
      .then(setProfessionals)
      .catch(() => setProfessionals([]));
    recordApi
      .clients(establishmentId)
      .then(setClients)
      .catch(() => setClients([]));
  }, [establishmentId]);

  const gross = useMemo(
    () => round2(cart.reduce((s, l) => s + l.qty * l.unitPrice, 0)),
    [cart]
  );
  const discountN = Math.max(0, Number(discount) || 0);
  const feeN = Math.max(0, Number(fee) || 0);
  const total = round2(Math.max(0, gross - discountN));

  const paidSum = round2(parts.reduce((s, p) => s + (p.amount || 0), 0));
  const remaining = round2(total - paidSum);

  const addLine = (line: Omit<CartLine, "key">) => {
    setCart((c) => {
      // se ja existe a mesma ref (servico/produto), soma quantidade
      const idx = c.findIndex(
        (l) => l.kind === line.kind && l.refId && l.refId === line.refId
      );
      if (idx >= 0) {
        const copy = [...c];
        const max = copy[idx].maxStock;
        const nextQty = copy[idx].qty + line.qty;
        copy[idx] = {
          ...copy[idx],
          qty: max ? Math.min(nextQty, max) : nextQty,
        };
        return copy;
      }
      return [...c, { ...line, key: newKey() }];
    });
  };

  const addService = (s: Service) =>
    addLine({
      kind: "servico",
      refId: s._id,
      name: s.title,
      qty: 1,
      unitPrice: s.price,
    });

  const addProduct = (p: Product) => {
    if (p.stock <= 0) return;
    addLine({
      kind: "produto",
      refId: p._id,
      name: p.name,
      qty: 1,
      unitPrice: p.price,
      maxStock: p.stock,
    });
  };

  const addAvulso = () => {
    const price = Number(avPrice);
    if (!avName.trim() || isNaN(price) || price <= 0) return;
    addLine({
      kind: "avulso",
      refId: null,
      name: avName.trim(),
      qty: 1,
      unitPrice: round2(price),
    });
    setAvName("");
    setAvPrice("");
  };

  const setQty = (key: string, qty: number) =>
    setCart((c) =>
      c.map((l) =>
        l.key === key
          ? {
              ...l,
              qty: Math.max(
                1,
                l.maxStock ? Math.min(qty, l.maxStock) : qty
              ),
            }
          : l
      )
    );

  const removeLine = (key: string) =>
    setCart((c) => c.filter((l) => l.key !== key));

  const setPart = (i: number, patch: Partial<CashPayment>) =>
    setParts((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addPart = () =>
    setParts((p) => [...p, { method: "pix", amount: Math.max(0, remaining) }]);
  const removePart = (i: number) =>
    setParts((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const filteredServices = services.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const clientMatches =
    clientName.trim().length > 0
      ? clients
          .filter((c) =>
            c.name.toLowerCase().includes(clientName.toLowerCase())
          )
          .slice(0, 6)
      : clients.slice(0, 6);

  const submit = async () => {
    setError(null);
    if (cart.length === 0) {
      setError("Adicione ao menos um item.");
      return;
    }
    if (total <= 0) {
      setError("O total da venda precisa ser maior que zero.");
      return;
    }

    let payments: CashPayment[] | undefined;
    if (!fiado) {
      if (split) {
        payments = parts.filter((p) => p.amount > 0);
        if (Math.abs(paidSum - total) > 0.01) {
          setError(
            `A soma dos pagamentos (${BRL(paidSum)}) não bate com o total (${BRL(
              total
            )}).`
          );
          return;
        }
      } else {
        payments = [{ method: parts[0].method, amount: total }];
      }
    }

    const items: SaleItemInput[] = cart.map((l) => ({
      kind: l.kind,
      refId: l.refId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
    }));

    setSubmitting(true);
    try {
      const res = await cashApi.sale(establishmentId, {
        items,
        discount: discountN || undefined,
        fee: feeN || undefined,
        payments,
        receivable: fiado || undefined,
        dueDate: fiado && dueDate ? dueDate : undefined,
        clientId: clientId || undefined,
        clientName: clientName.trim() || undefined,
        professionalId: professionalId || undefined,
      });
      const warn = res.warnings?.length ? " " + res.warnings.join(" ") : "";
      onDone(
        (fiado ? "Venda a prazo registrada." : "Venda registrada.") + warn
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || "Não foi possível registrar a venda.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink/10 p-5">
          <h2 className="font-display text-xl font-bold text-ink">Nova venda</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden md:grid-cols-2">
          {/* ---- catálogo ---- */}
          <div className="flex flex-col overflow-hidden border-b border-ink/10 md:border-b-0 md:border-r">
            <div className="flex gap-1 p-3">
              {(["servico", "produto", "avulso"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setPickKind(k)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    pickKind === k
                      ? "bg-teal-500 text-white"
                      : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                  }`}
                >
                  {k === "servico" ? "Serviços" : k === "produto" ? "Produtos" : "Avulso"}
                </button>
              ))}
            </div>

            {pickKind !== "avulso" && (
              <div className="px-3 pb-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="h-9 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </div>
            )}

            <div className="min-h-[180px] flex-1 overflow-y-auto px-3 pb-3">
              {pickKind === "servico" &&
                (filteredServices.length === 0 ? (
                  <p className="p-4 text-center text-sm text-ink/40">
                    Nenhum serviço.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredServices.map((s) => (
                      <button
                        key={s._id}
                        onClick={() => addService(s)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink/10 bg-white p-2.5 text-left text-sm transition hover:border-teal-500"
                      >
                        <span className="text-ink">{s.title}</span>
                        <span className="font-semibold text-teal-600">
                          {BRL(s.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}

              {pickKind === "produto" &&
                (filteredProducts.length === 0 ? (
                  <p className="p-4 text-center text-sm text-ink/40">
                    Nenhum produto.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredProducts.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => addProduct(p)}
                        disabled={p.stock <= 0}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink/10 bg-white p-2.5 text-left text-sm transition hover:border-teal-500 disabled:opacity-40"
                      >
                        <span className="text-ink">
                          {p.name}
                          <span className="ml-1 text-xs text-ink/40">
                            {p.stock > 0 ? `(${p.stock} un)` : "(sem estoque)"}
                          </span>
                        </span>
                        <span className="font-semibold text-teal-600">
                          {BRL(p.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}

              {pickKind === "avulso" && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-ink/50">
                    Item livre (não cadastrado): dê um nome e o valor.
                  </p>
                  <input
                    value={avName}
                    onChange={(e) => setAvName(e.target.value)}
                    placeholder="Ex: taxa extra, item avulso"
                    className="h-9 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={avPrice}
                      onChange={(e) => setAvPrice(e.target.value)}
                      placeholder="Valor"
                      className="h-9 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                    />
                    <button
                      onClick={addAvulso}
                      className="h-9 shrink-0 rounded-lg bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ---- carrinho + pagamento ---- */}
          <div className="flex flex-col overflow-y-auto p-4">
            {cart.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/40">
                Toque nos itens à esquerda para montar a venda.
              </p>
            ) : (
              <div className="space-y-1.5">
                {cart.map((l) => (
                  <div
                    key={l.key}
                    className="flex items-center gap-2 rounded-lg border border-ink/10 bg-white p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {l.name}
                      </p>
                      <p className="text-xs text-ink/50">{BRL(l.unitPrice)} un.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQty(l.key, l.qty - 1)}
                        className="h-6 w-6 rounded bg-ink/5 text-ink/70 hover:bg-ink/10"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm">{l.qty}</span>
                      <button
                        onClick={() => setQty(l.key, l.qty + 1)}
                        className="h-6 w-6 rounded bg-ink/5 text-ink/70 hover:bg-ink/10"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-20 text-right text-sm font-semibold text-teal-600">
                      {BRL(l.qty * l.unitPrice)}
                    </span>
                    <button
                      onClick={() => removeLine(l.key)}
                      className="rounded px-1.5 text-red-500 hover:bg-red-50"
                      aria-label="Remover"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* cliente / profissional */}
            <div className="mt-4 grid grid-cols-1 gap-2">
              <div className="relative">
                <label className="mb-1 block text-xs font-medium text-ink/60">
                  Cliente (opcional)
                </label>
                <input
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setClientId(null);
                    setShowClientList(true);
                  }}
                  onFocus={() => setShowClientList(true)}
                  placeholder="Nome do cliente ou balcão"
                  className="h-9 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
                {showClientList && clientMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-ink/15 bg-white shadow-lg">
                    {clientMatches.map((c) => (
                      <button
                        key={c._id}
                        onClick={() => {
                          setClientId(c._id);
                          setClientName(c.name);
                          setShowClientList(false);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-sand"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {professionals.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink/60">
                    Profissional (opcional)
                  </label>
                  <select
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="">—</option>
                    {professionals.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* desconto / taxa */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink/60">
                  Desconto (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0,00"
                  className="h-9 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink/60">
                  Taxa cartão (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0,00"
                  className="h-9 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* pagamento */}
            <div className="mt-4 rounded-xl bg-sand/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">Pagamento</span>
                <label className="flex items-center gap-2 text-xs font-medium text-ink/60">
                  <input
                    type="checkbox"
                    checked={fiado}
                    onChange={(e) => setFiado(e.target.checked)}
                  />
                  Fiado (pagar depois)
                </label>
              </div>

              {fiado ? (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-medium text-ink/60">
                    Vencimento (opcional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                  />
                  <p className="mt-1 text-xs text-ink/50">
                    A venda fica em “A receber” e só entra no caixa quando for paga.
                  </p>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {!split ? (
                    <select
                      value={parts[0].method}
                      onChange={(e) =>
                        setPart(0, { method: e.target.value as PaymentMethod })
                      }
                      className="h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                    >
                      {METHODS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      {parts.map((p, i) => (
                        <div key={i} className="flex gap-2">
                          <select
                            value={p.method}
                            onChange={(e) =>
                              setPart(i, {
                                method: e.target.value as PaymentMethod,
                              })
                            }
                            className="h-9 flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                          >
                            {METHODS.map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={p.amount || ""}
                            onChange={(e) =>
                              setPart(i, {
                                amount: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            placeholder="0,00"
                            className="h-9 w-24 rounded-lg border border-ink/15 px-2 text-sm outline-none focus:border-teal-500"
                          />
                          <button
                            onClick={() => removePart(i)}
                            className="rounded px-2 text-red-500 hover:bg-red-50"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs">
                        <button
                          onClick={addPart}
                          className="font-medium text-teal-600 hover:underline"
                        >
                          + parcela
                        </button>
                        <span
                          className={
                            Math.abs(remaining) < 0.01
                              ? "text-ink/50"
                              : "font-medium text-amber-600"
                          }
                        >
                          {Math.abs(remaining) < 0.01
                            ? "Bate certo"
                            : remaining > 0
                            ? `Falta ${BRL(remaining)}`
                            : `Excede ${BRL(-remaining)}`}
                        </span>
                      </div>
                    </>
                  )}
                  <label className="flex items-center gap-2 text-xs font-medium text-ink/60">
                    <input
                      type="checkbox"
                      checked={split}
                      onChange={(e) => {
                        setSplit(e.target.checked);
                        if (e.target.checked)
                          setParts([{ method: "dinheiro", amount: total }]);
                        else setParts([{ method: parts[0].method, amount: 0 }]);
                      }}
                    />
                    Dividir pagamento
                  </label>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* rodapé: total + confirmar */}
        <div className="flex items-center justify-between gap-3 border-t border-ink/10 p-4">
          <div>
            {discountN > 0 && (
              <p className="text-xs text-ink/50">
                Subtotal {BRL(gross)} · desconto −{BRL(discountN)}
              </p>
            )}
            <p className="text-2xl font-bold text-ink">{BRL(total)}</p>
          </div>
          <button
            onClick={submit}
            disabled={submitting || cart.length === 0}
            className="h-12 rounded-xl bg-teal-500 px-8 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {submitting
              ? "Registrando..."
              : fiado
              ? "Registrar fiado"
              : "Confirmar venda"}
          </button>
        </div>
      </div>
    </div>
  );
}
