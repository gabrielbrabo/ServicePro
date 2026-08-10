import { useEffect, useState, useCallback } from "react";
import {
  cashApi,
  CashSession,
  CashMovement,
  CashTotals,
  MovementType,
  PaymentMethod,
} from "../api/cash";
import { establishmentApi } from "../api/establishment";
import { CashReportModal } from "./CashReportModal";
import { productApi, Product } from "../api/product";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const TYPE_LABEL: Record<MovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  sangria: "Sangria",
  suprimento: "Suprimento",
};

const TYPE_STYLE: Record<MovementType, string> = {
  entrada: "bg-teal-50 text-teal-700",
  saida: "bg-red-50 text-red-600",
  sangria: "bg-amber-400/20 text-amber-700",
  suprimento: "bg-teal-50 text-teal-700",
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "Pix",
  outro: "Outro",
};

const isPositive = (t: MovementType) => t === "entrada" || t === "suprimento";

export function CashRegister({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CashSession | null>(null);
  const [totals, setTotals] = useState<CashTotals | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [autoEntry, setAutoEntry] = useState(true);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [establishmentName, setEstablishmentName] = useState<string>("");

  const [openingAmount, setOpeningAmount] = useState("0");
  const [opening, setOpening] = useState(false);

  const [mType, setMType] = useState<MovementType>("entrada");
  const [mMethod, setMMethod] = useState<PaymentMethod>("dinheiro");
  const [mAmount, setMAmount] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [savingMov, setSavingMov] = useState(false);

  const [closingOpen, setClosingOpen] = useState(false);
  const [countedAmount, setCountedAmount] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [closing, setClosing] = useState(false);

  // venda de produto
  const [products, setProducts] = useState<Product[]>([]);
  const [sellProductId, setSellProductId] = useState("");
  const [sellQty, setSellQty] = useState("1");
  const [sellMethod, setSellMethod] = useState<PaymentMethod>("dinheiro");
  const [selling, setSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellNotice, setSellNotice] = useState<string | null>(null);

  const [history, setHistory] = useState<CashSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // sessão selecionada para ver o relatório
  const [reportSession, setReportSession] = useState<CashSession | null>(null);

  const loadCurrent = useCallback(() => {
    setLoading(true);
    cashApi
      .current(establishmentId)
      .then((data) => {
        setSession(data.session);
        setTotals(data.totals ?? null);
        setMovements(data.movements ?? []);
      })
      .catch(() => setError("Não foi possível carregar o caixa."))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    cashApi
      .history(establishmentId)
      .then((data) => setHistory(data.sessions))
      .catch(() => {
        /* histórico é secundário */
      })
      .finally(() => setLoadingHistory(false));
  }, [establishmentId]);

  useEffect(() => {
    loadCurrent();
    loadHistory();
    establishmentApi
      .getOne(establishmentId)
      .then((est) => {
        setAutoEntry(est.cashAutoEntry !== false);
        setEstablishmentName(est.name);
      })
      .catch(() => {
        /* mantém ligado por padrão */
      });
    productApi
      .list(establishmentId)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [loadCurrent, loadHistory, establishmentId]);

  useEffect(() => {
    if (mType === "sangria" || mType === "suprimento") {
      setMMethod("dinheiro");
    }
  }, [mType]);

  const toggleAutoEntry = async () => {
    const next = !autoEntry;
    setAutoEntry(next);
    setTogglingAuto(true);
    try {
      await establishmentApi.update(establishmentId, { cashAutoEntry: next });
    } catch {
      setAutoEntry(!next);
      setError("Não foi possível alterar o lançamento automático.");
    } finally {
      setTogglingAuto(false);
    }
  };

  const openCash = async () => {
    const val = Number(openingAmount);
    if (isNaN(val) || val < 0) {
      setError("Valor de abertura inválido.");
      return;
    }
    setOpening(true);
    setError(null);
    setNotice(null);
    try {
      const res = await cashApi.open(establishmentId, val);
      setOpeningAmount("0");
      if (res.postedCount > 0) {
        setNotice(
          `${res.postedCount} atendimento(s) concluído(s) pendente(s) foram lançados no caixa.`
        );
      }
      loadCurrent();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 409
          ? "Já existe um caixa aberto."
          : "Não foi possível abrir o caixa."
      );
    } finally {
      setOpening(false);
    }
  };

  const addMovement = async () => {
    const val = Number(mAmount);
    if (isNaN(val) || val <= 0) {
      setError("Informe um valor válido para o movimento.");
      return;
    }
    setSavingMov(true);
    setError(null);
    try {
      const res = await cashApi.addMovement(establishmentId, {
        type: mType,
        method: mMethod,
        amount: val,
        description: mDesc.trim() || undefined,
      });
      setMovements((list) => [res.movement, ...list]);
      setTotals(res.totals);
      setMAmount("");
      setMDesc("");
    } catch {
      setError("Não foi possível lançar o movimento.");
    } finally {
      setSavingMov(false);
    }
  };

  const doClose = async () => {
    const val = Number(countedAmount);
    if (isNaN(val) || val < 0) {
      setError("Informe quanto foi contado no caixa.");
      return;
    }
    setClosing(true);
    setError(null);
    try {
      await cashApi.close(establishmentId, {
        countedAmount: val,
        closingNotes: closingNotes.trim() || undefined,
      });
      setClosingOpen(false);
      setCountedAmount("");
      setClosingNotes("");
      loadCurrent();
      loadHistory();
    } catch {
      setError("Não foi possível fechar o caixa.");
    } finally {
      setClosing(false);
    }
  };

  const sell = async () => {
    const qty = Number(sellQty);
    setSellError(null);
    setSellNotice(null);

    if (!sellProductId) {
      setSellError("Escolha um produto.");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setSellError("Quantidade inválida.");
      return;
    }

    setSelling(true);
    try {
      const res = await cashApi.sell(establishmentId, {
        productId: sellProductId,
        quantity: qty,
        method: sellMethod,
      });
      setMovements((list) => [res.movement, ...list]);
      setTotals(res.totals);
      setProducts((list) =>
        list.map((p) =>
          p._id === res.product._id ? { ...p, stock: res.product.stock } : p
        )
      );
      setSellQty("1");

      // confirmação e avisos ficam no próprio card
      setSellNotice(
        res.warnings?.length
          ? `Venda registrada. ${res.warnings.join(" ")}`
          : "Venda registrada."
      );
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: { message?: string } };
      };
      setSellError(
        err?.response?.data?.message || "Não foi possível registrar a venda."
      );
    } finally {
      setSelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando caixa...
      </div>
    );
  }

  const previewDiff =
    totals && countedAmount !== ""
      ? Number(countedAmount) - totals.expectedCash
      : null;

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-700">
          {notice}
        </div>
      )}

      {/* ---- SEM CAIXA ABERTO ---- */}
      {!session ? (
        <div className="rounded-2xl border border-ink/10 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-ink">
            Abrir caixa
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Informe o fundo de troco inicial. Atendimentos concluídos pendentes
            entrarão automaticamente ao abrir.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Valor de abertura (R$)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="h-11 w-40 rounded-xl border border-ink/15 px-3 outline-none focus:border-teal-500"
              />
            </label>
            <button
              onClick={openCash}
              disabled={opening}
              className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {opening ? "Abrindo..." : "Abrir caixa"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-teal-700 p-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-teal-100">
                  Caixa aberto desde {fmtDateTime(session.openedAt)}
                  {typeof session.openedBy === "object" &&
                    session.openedBy?.name &&
                    ` · aberto por ${session.openedBy.name}`}
                </p>
                <p className="mt-1 text-3xl font-bold">
                  {totals ? BRL(totals.expectedCash) : BRL(session.openingAmount)}
                </p>
                <p className="text-sm text-teal-100">em dinheiro na gaveta</p>
              </div>
              <button
                onClick={() => setClosingOpen(true)}
                className="rounded-xl bg-amber-400 px-5 py-2.5 font-semibold text-ink transition hover:bg-amber-500"
              >
                Fechar caixa
              </button>
            </div>

            {totals && (
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-teal-100">Abertura</p>
                  <p className="font-semibold">{BRL(session.openingAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-teal-100">Dinheiro</p>
                  <p className="font-semibold">{BRL(totals.byMethod.dinheiro)}</p>
                </div>
                <div>
                  <p className="text-xs text-teal-100">Cartão</p>
                  <p className="font-semibold">{BRL(totals.byMethod.cartao)}</p>
                </div>
                <div>
                  <p className="text-xs text-teal-100">Pix</p>
                  <p className="font-semibold">{BRL(totals.byMethod.pix)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Toggle: lançamento automático */}
          <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white p-4">
            <div>
              <p className="font-medium text-ink">Lançamento automático</p>
              <p className="text-sm text-ink/60">
                Ao concluir um atendimento, lança a entrada no caixa automaticamente.
              </p>
            </div>
            <button
              onClick={toggleAutoEntry}
              disabled={togglingAuto}
              className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${autoEntry ? "bg-teal-500" : "bg-ink/20"
                }`}
              aria-pressed={autoEntry}
              aria-label="Alternar lançamento automático"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${autoEntry ? "left-[22px]" : "left-0.5"
                  }`}
              />
            </button>
          </div>

          {/* Venda de produto */}
          {products.length > 0 && (
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h3 className="font-display text-lg font-bold text-ink">
                Vender produto
              </h3>
              <p className="mt-1 text-sm text-ink/60">
                Lança a entrada no caixa e dá baixa no estoque.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-ink/70">
                    Produto
                  </span>
                  <select
                    value={sellProductId}
                    onChange={(e) => {
                      setSellProductId(e.target.value);
                      setSellError(null);
                      setSellNotice(null);
                    }}
                    className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Selecione...</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id} disabled={p.stock <= 0}>
                        {p.name} — {BRL(p.price)}
                        {p.stock <= 0 ? " (sem estoque)" : ` (${p.stock} un)`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink/70">
                    Qtd
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={sellQty}
                    onChange={(e) => {
                      setSellQty(e.target.value);
                      setSellError(null);
                      setSellNotice(null);
                    }}
                    className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink/70">
                    Pagamento
                  </span>
                  <select
                    value={sellMethod}
                    onChange={(e) =>
                      setSellMethod(e.target.value as PaymentMethod)
                    }
                    className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="pix">Pix</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>
              </div>

              {/* total da venda */}
              {sellProductId && Number(sellQty) > 0 && (
                <p className="mt-3 text-sm text-ink/70">
                  Total:{" "}
                  <strong className="text-teal-600">
                    {BRL(
                      (products.find((p) => p._id === sellProductId)?.price ??
                        0) * Number(sellQty)
                    )}
                  </strong>
                </p>
              )}

              <button
                onClick={sell}
                disabled={selling || !sellProductId}
                className="mt-4 h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
              >
                {selling ? "Registrando..." : "Registrar venda"}
              </button>

              {sellError && (
                <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {sellError}
                </div>
              )}

              {sellNotice && (
                <div className="mt-3 rounded-xl bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-700">
                  ✓ {sellNotice}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <h3 className="font-display text-lg font-bold text-ink">
              Lançar movimento
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["entrada", "saida", "sangria", "suprimento"] as MovementType[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMType(t)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${mType === t
                      ? "border-teal-500 bg-teal-500 text-white"
                      : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                      }`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                )
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Valor (R$)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={mAmount}
                  onChange={(e) => setMAmount(e.target.value)}
                  placeholder="0,00"
                  className="h-11 w-full rounded-xl border border-ink/15 px-3 outline-none focus:border-teal-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Forma de pagamento
                </span>
                <select
                  value={mMethod}
                  onChange={(e) => setMMethod(e.target.value as PaymentMethod)}
                  disabled={mType === "sangria" || mType === "suprimento"}
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500 disabled:opacity-60"
                >
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                  <option value="pix">Pix</option>
                  <option value="outro">Outro</option>
                </select>
                {(mType === "sangria" || mType === "suprimento") && (
                  <span className="mt-1 block text-xs text-ink/40">
                    Sangria e suprimento são sempre em dinheiro.
                  </span>
                )}
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Descrição (opcional)
              </span>
              <input
                type="text"
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
                placeholder="Ex: venda de produto, pagamento fornecedor"
                className="h-11 w-full rounded-xl border border-ink/15 px-3 outline-none focus:border-teal-500"
              />
            </label>

            <button
              onClick={addMovement}
              disabled={savingMov}
              className="mt-4 h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {savingMov ? "Lançando..." : "Lançar"}
            </button>
          </div>

          <div>
            <h3 className="mb-3 font-display text-lg font-bold text-ink">
              Movimentos de hoje
            </h3>
            {movements.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
                Nenhum movimento lançado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {movements.map((m) => (
                  <div
                    key={m._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLE[m.type]}`}
                      >
                        {TYPE_LABEL[m.type]}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {m.description || TYPE_LABEL[m.type]}
                        </p>
                        <p className="text-xs text-ink/50">
                          {METHOD_LABEL[m.method]} · {fmtDateTime(m.createdAt)}
                          {m.professionalName ? ` · ${m.professionalName}` : ""}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-semibold ${isPositive(m.type) ? "text-teal-600" : "text-red-600"
                        }`}
                    >
                      {isPositive(m.type) ? "+" : "−"} {BRL(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- HISTÓRICO (clicável) ---- */}
      <div>
        <h3 className="mb-3 font-display text-lg font-bold text-ink">
          Fechamentos anteriores
        </h3>
        {loadingHistory ? (
          <p className="text-ink/50">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
            Nenhum caixa fechado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((s) => {
              const diff = s.difference ?? 0;
              const diffLabel =
                diff === 0
                  ? "Bateu certo"
                  : diff > 0
                    ? `Sobra ${BRL(diff)}`
                    : `Falta ${BRL(Math.abs(diff))}`;
              const diffStyle =
                diff === 0
                  ? "text-ink/50"
                  : diff > 0
                    ? "text-teal-600"
                    : "text-red-600";
              return (
                <button
                  key={s._id}
                  onClick={() => setReportSession(s)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3 text-left transition hover:border-teal-500 hover:shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {s.closedAt ? fmtDateTime(s.closedAt) : "—"}
                      {typeof s.closedBy === "object" &&
                        s.closedBy?.name &&
                        ` · por ${s.closedBy.name}`}
                    </p>
                    <p className="text-xs text-ink/50">
                      Esperado {BRL(s.expectedAmount ?? 0)} · Contado{" "}
                      {BRL(s.countedAmount ?? 0)}
                      {s.report
                        ? ` · Faturamento ${BRL(s.report.totalRevenue)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${diffStyle}`}>
                      {diffLabel}
                    </span>
                    <span className="text-sm font-medium text-teal-600">
                      Ver relatório →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- MODAL DE FECHAMENTO (com resumo completo) ---- */}
      {closingOpen && session && totals && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => !closing && setClosingOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-ink/10 p-6">
              <h2 className="font-display text-xl font-bold text-ink">
                Fechar caixa
              </h2>
              <p className="mt-1 text-sm text-ink/60">
                Confira o resumo e informe quanto contou em dinheiro.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Resumo por forma de pagamento */}
              <div className="mb-5">
                <p className="mb-2 text-sm font-medium text-ink/70">
                  Resumo da sessão
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-sand/60 p-3">
                    <p className="text-xs text-ink/50">Abertura</p>
                    <p className="font-semibold text-ink">
                      {BRL(session.openingAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sand/60 p-3">
                    <p className="text-xs text-ink/50">Dinheiro</p>
                    <p className="font-semibold text-ink">
                      {BRL(totals.byMethod.dinheiro)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sand/60 p-3">
                    <p className="text-xs text-ink/50">Cartão</p>
                    <p className="font-semibold text-ink">
                      {BRL(totals.byMethod.cartao)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sand/60 p-3">
                    <p className="text-xs text-ink/50">Pix</p>
                    <p className="font-semibold text-ink">
                      {BRL(totals.byMethod.pix)}
                    </p>
                  </div>
                  {totals.byMethod.outro > 0 && (
                    <div className="rounded-xl bg-sand/60 p-3">
                      <p className="text-xs text-ink/50">Outro</p>
                      <p className="font-semibold text-ink">
                        {BRL(totals.byMethod.outro)}
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl bg-teal-500/10 p-3">
                    <p className="text-xs text-teal-700/70">
                      Faturamento (entradas)
                    </p>
                    <p className="font-semibold text-teal-700">
                      {BRL(totals.byType.entrada)}
                    </p>
                  </div>
                </div>

                {(totals.byType.sangria > 0 || totals.byType.saida > 0) && (
                  <p className="mt-2 text-xs text-ink/50">
                    Saídas {BRL(totals.byType.saida)} · Sangrias{" "}
                    {BRL(totals.byType.sangria)} · Suprimentos{" "}
                    {BRL(totals.byType.suprimento)}
                  </p>
                )}
              </div>

              {/* Conferência do dinheiro */}
              <div className="rounded-xl border border-ink/10 p-4">
                <p className="text-sm text-ink/70">
                  O sistema espera{" "}
                  <strong className="text-ink">{BRL(totals.expectedCash)}</strong>{" "}
                  em dinheiro na gaveta.
                </p>
                <p className="mt-1 text-xs text-ink/50">
                  Cartão e pix não entram na contagem física — o valor já está
                  na maquininha/banco.
                </p>

                <label className="mt-3 block">
                  <span className="mb-1 block text-sm font-medium text-ink/70">
                    Valor contado em dinheiro (R$)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={countedAmount}
                    onChange={(e) => setCountedAmount(e.target.value)}
                    placeholder="0,00"
                    className="h-11 w-full rounded-xl border border-ink/15 px-3 outline-none focus:border-teal-500"
                  />
                </label>

                {previewDiff !== null && (
                  <p
                    className={`mt-2 text-sm font-medium ${previewDiff === 0
                      ? "text-ink/60"
                      : previewDiff > 0
                        ? "text-teal-600"
                        : "text-red-600"
                      }`}
                  >
                    {previewDiff === 0
                      ? "Bate certo com o esperado."
                      : previewDiff > 0
                        ? `Sobra de ${BRL(previewDiff)}.`
                        : `Falta de ${BRL(Math.abs(previewDiff))}.`}
                  </p>
                )}
              </div>

              <label className="mt-4 block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Observações (opcional)
                </span>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  rows={2}
                  placeholder="Alguma observação sobre o fechamento?"
                  className="w-full rounded-xl border border-ink/15 px-3 py-2 outline-none focus:border-teal-500"
                />
              </label>
            </div>

            <div className="flex gap-2 border-t border-ink/10 p-6">
              <button
                onClick={doClose}
                disabled={closing}
                className="h-11 flex-1 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {closing ? "Fechando..." : "Confirmar fechamento"}
              </button>
              <button
                onClick={() => setClosingOpen(false)}
                disabled={closing}
                className="h-11 rounded-xl border border-ink/15 px-5 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- MODAL DO RELATÓRIO ---- */}
      {reportSession && (
        <CashReportModal
          session={reportSession}
          establishmentName={establishmentName}
          onClose={() => setReportSession(null)}
        />
      )}
    </div>
  );
}