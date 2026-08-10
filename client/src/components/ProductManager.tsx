import { useEffect, useState, useCallback } from "react";
import { productApi, Product } from "../api/product";
import { ImageUpload } from "./ImageUpload";
import { StockMovementModal } from "./StockMovementModal";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type StockLevel = "zerado" | "baixo" | "ok";

const stockLevel = (p: Product): StockLevel => {
  if (p.stock <= 0) return "zerado";
  if (p.minStock > 0 && p.stock <= p.minStock) return "baixo";
  return "ok";
};

const STOCK_STYLE: Record<StockLevel, string> = {
  zerado: "bg-red-50 text-red-600",
  baixo: "bg-amber-400/20 text-amber-700",
  ok: "bg-teal-50 text-teal-700",
};

const STOCK_LABEL: Record<StockLevel, string> = {
  zerado: "Sem estoque",
  baixo: "Estoque baixo",
  ok: "Em estoque",
};

const emptyForm = {
  name: "",
  description: "",
  photo: "",
  price: "",
  cost: "",
  stock: "",
  minStock: "",
  supplier: "",
  barcode: "",
};

export function ProductManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [savingEdit, setSavingEdit] = useState(false);

  // produto em movimentação de estoque (abre o modal)
  const [movingProduct, setMovingProduct] = useState<Product | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    productApi
      .list(establishmentId, { all: true })
      .then(setProducts)
      .catch(() => setError("Não foi possível carregar os produtos."))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  useEffect(load, [load]);

  const setField = (field: keyof typeof emptyForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const setEditField = (field: keyof typeof emptyForm, value: string) =>
    setEditForm((f) => ({ ...f, [field]: value }));

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    const price = Number(form.price);
    if (isNaN(price) || price < 0) {
      setError("Informe um preço válido.");
      return;
    }

    setSaving(true);
    try {
      const created = await productApi.create(establishmentId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        photo: form.photo || undefined,
        price,
        cost: form.cost ? Number(form.cost) : undefined,
        stock: form.stock ? Number(form.stock) : undefined,
        minStock: form.minStock ? Number(form.minStock) : undefined,
        supplier: form.supplier.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
      });
      setProducts((list) =>
        [...list, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setForm({ ...emptyForm });
      setShowForm(false);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 409
          ? "Já existe um produto com este código de barras."
          : "Não foi possível criar o produto."
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p._id);
    setEditForm({
      name: p.name,
      description: p.description,
      photo: p.photo,
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      minStock: String(p.minStock),
      supplier: p.supplier,
      barcode: p.barcode,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ ...emptyForm });
  };

  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await productApi.update(establishmentId, id, {
        name: editForm.name.trim(),
        description: editForm.description,
        photo: editForm.photo,
        price: Number(editForm.price),
        cost: Number(editForm.cost) || 0,
        minStock: Number(editForm.minStock) || 0,
        supplier: editForm.supplier,
        barcode: editForm.barcode,
      });
      setProducts((list) => list.map((x) => (x._id === id ? updated : x)));
      cancelEdit();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 409
          ? "Já existe um produto com este código de barras."
          : "Não foi possível salvar o produto."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleActive = async (p: Product) => {
    const prev = products;
    setProducts((list) =>
      list.map((x) => (x._id === p._id ? { ...x, active: !x.active } : x))
    );
    try {
      await productApi.update(establishmentId, p._id, { active: !p.active });
    } catch {
      setProducts(prev);
      setError("Não foi possível atualizar o produto.");
    }
  };

  // atualiza o produto na lista após uma movimentação de estoque
  const handleStockUpdated = (updated: Product) => {
    setProducts((list) =>
      list.map((x) => (x._id === updated._id ? updated : x))
    );
    setMovingProduct(updated);
  };

  const visible = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    );
  });

  const lowStockCount = products.filter(
    (p) => p.active && stockLevel(p) !== "ok"
  ).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink/60">
            {products.length} produto{products.length !== 1 ? "s" : ""}{" "}
            cadastrado{products.length !== 1 ? "s" : ""}.
          </p>
          {lowStockCount > 0 && (
            <p className="mt-0.5 text-sm font-medium text-amber-700">
              ⚠ {lowStockCount} produto{lowStockCount !== 1 ? "s" : ""} com
              estoque baixo ou zerado.
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Novo produto"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Formulário de criação */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-display text-lg font-bold text-ink">
            Novo produto
          </h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
            <ImageUpload
              value={form.photo}
              onChange={(url) => setField("photo", url)}
              folder="produtos"
              label="Foto"
              hint="JPG, PNG ou WEBP."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Nome
                </span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ex: Shampoo hidratante 300ml"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Preço de venda (R$)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  placeholder="0,00"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Custo de compra (R$)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setField("cost", e.target.value)}
                  placeholder="0,00"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Estoque inicial
                </span>
                <input
                  type="number"
                  step="1"
                  value={form.stock}
                  onChange={(e) => setField("stock", e.target.value)}
                  placeholder="0"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Estoque mínimo (alerta)
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.minStock}
                  onChange={(e) => setField("minStock", e.target.value)}
                  placeholder="0"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Fornecedor
                </span>
                <input
                  type="text"
                  value={form.supplier}
                  onChange={(e) => setField("supplier", e.target.value)}
                  placeholder="Opcional"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Código de barras
                </span>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => setField("barcode", e.target.value)}
                  placeholder="Opcional"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Descrição
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={2}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={saving}
            className="mt-4 h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar produto"}
          </button>
        </div>
      )}

      {/* Busca */}
      {products.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código de barras..."
          className="mb-4 h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
        />
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-12 text-center text-ink/50">
          {products.length === 0
            ? "Nenhum produto cadastrado ainda."
            : "Nenhum produto encontrado para esta busca."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => {
            const level = stockLevel(p);
            const editing = editingId === p._id;

            return (
              <div
                key={p._id}
                className={`rounded-2xl border bg-white p-4 ${
                  p.active ? "border-ink/10" : "border-ink/10 opacity-60"
                }`}
              >
                {editing ? (
                  <div>
                    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                      <ImageUpload
                        value={editForm.photo}
                        onChange={(url) => setEditField("photo", url)}
                        folder="produtos"
                        label="Foto"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="mb-1 block text-sm font-medium text-ink/70">
                            Nome
                          </span>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditField("name", e.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
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
                            value={editForm.price}
                            onChange={(e) =>
                              setEditField("price", e.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-ink/70">
                            Custo (R$)
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.cost}
                            onChange={(e) =>
                              setEditField("cost", e.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-ink/70">
                            Estoque mínimo
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={editForm.minStock}
                            onChange={(e) =>
                              setEditField("minStock", e.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-ink/70">
                            Fornecedor
                          </span>
                          <input
                            type="text"
                            value={editForm.supplier}
                            onChange={(e) =>
                              setEditField("supplier", e.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="mb-1 block text-sm font-medium text-ink/70">
                            Código de barras
                          </span>
                          <input
                            type="text"
                            value={editForm.barcode}
                            onChange={(e) =>
                              setEditField("barcode", e.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                          />
                        </label>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-ink/40">
                      O estoque atual ({p.stock}) muda apenas por movimentação
                      de estoque.
                    </p>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => saveEdit(p._id)}
                        disabled={savingEdit}
                        className="h-10 rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
                      >
                        {savingEdit ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="h-10 rounded-xl border border-ink/15 px-5 text-sm font-medium text-ink/70 transition hover:bg-sand"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-3">
                      {p.photo ? (
                        <img
                          src={p.photo}
                          alt={p.name}
                          className="h-16 w-16 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-sand text-2xl text-ink/30">
                          📦
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display font-bold text-ink">
                            {p.name}
                          </h4>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STOCK_STYLE[level]}`}
                          >
                            {STOCK_LABEL[level]} · {p.stock}
                          </span>
                          {!p.active && (
                            <span className="text-xs text-ink/40">
                              (inativo)
                            </span>
                          )}
                        </div>

                        {p.description && (
                          <p className="mt-0.5 line-clamp-1 text-sm text-ink/60">
                            {p.description}
                          </p>
                        )}

                        <p className="mt-1 text-sm">
                          <span className="font-semibold text-teal-600">
                            {BRL(p.price)}
                          </span>
                          {p.cost > 0 && (
                            <span className="text-xs text-ink/40">
                              {" "}
                              · custo {BRL(p.cost)}
                            </span>
                          )}
                        </p>

                        {(p.supplier || p.barcode) && (
                          <p className="mt-0.5 text-xs text-ink/40">
                            {p.supplier}
                            {p.supplier && p.barcode ? " · " : ""}
                            {p.barcode && `cód ${p.barcode}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setMovingProduct(p)}
                        className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-600"
                      >
                        Movimentar
                      </button>
                      <button
                        onClick={() => startEdit(p)}
                        className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActive(p)}
                        className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
                      >
                        {p.active ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de movimentação de estoque */}
      {movingProduct && (
        <StockMovementModal
          establishmentId={establishmentId}
          product={movingProduct}
          onClose={() => setMovingProduct(null)}
          onUpdated={handleStockUpdated}
        />
      )}
    </div>
  );
}