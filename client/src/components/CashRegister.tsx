import { useEffect, useState, useCallback, useRef } from "react";
import {
  cashApi,
  CashSession,
  CashMovement,
  CashTotals,
  MovementType,
  PaymentMethod,
  Denomination,
  Receivable,
} from "../api/cash";
import { establishmentApi } from "../api/establishment";
import { CashReportModal } from "./CashReportModal";
import { NewSaleModal } from "./NewSaleModal";
import { CashDashboard } from "./CashDashboard";
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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

// cédulas e moedas do real (para contagem no fechamento)
const DENOMS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05];

export function CashRegister({
  establishmentId,
  isOwner = true,
}: {
  establishmentId: string;
  isOwner?: boolean;
}) {
  const [view, setView] = useState<"caixa" | "relatorios">("caixa");

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
  const [useBreakdown, setUseBreakdown] = useState(false);
  const [denoms, setDenoms] = useState<Record<number, string>>({});

  const [products, setProducts] = useState<Product[]>([]);
  const [saleOpen, setSaleOpen] = useState(false);

  // filtros dos movimentos
  const [fType, setFType] = useState("");
  const [fMethod, setFMethod] = useState("");
  const [fQ, setFQ] = useState("");

  // estorno / recibo / receber
  const [voiding, setVoiding] = useState<CashMovement | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [receiving, setReceiving] = useState<Receivable | null>(null);
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>("dinheiro");
  const [actioning, setActioning] = useState(false);

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [receivablesTotal, setReceivablesTotal] = useState(0);

  const [history, setHistory] = useState<CashSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
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

  // fechamentos: rolagem infinita de 15 em 15
  const historyPageRef = useRef(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const loadingMoreHistoryRef = useRef(false);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    historyPageRef.current = 1;
    cashApi
      .history(establishmentId, 1)
      .then((data) => {
        setHistory(data.sessions);
        setHistoryHasMore(data.hasMore);
      })
      .catch(() => {
        /* histórico é secundário */
      })
      .finally(() => setLoadingHistory(false));
  }, [establishmentId]);

  const loadMoreHistory = useCallback(() => {
    if (loadingMoreHistoryRef.current || !historyHasMore) return;
    loadingMoreHistoryRef.current = true;
    setLoadingMoreHistory(true);
    const next = historyPageRef.current + 1;
    cashApi
      .history(establishmentId, next)
      .then((data) => {
        setHistory((prev) => [...prev, ...data.sessions]);
        historyPageRef.current = next;
        setHistoryHasMore(data.hasMore);
      })
      .catch(() => {})
      .finally(() => {
        loadingMoreHistoryRef.current = false;
        setLoadingMoreHistory(false);
      });
  }, [establishmentId, historyHasMore]);

  const historyObsRef = useRef<IntersectionObserver | null>(null);
  const historySentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (historyObsRef.current) {
        historyObsRef.current.disconnect();
        historyObsRef.current = null;
      }
      if (!node) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) loadMoreHistory();
        },
        { rootMargin: "240px" }
      );
      io.observe(node);
      historyObsRef.current = io;
    },
    [loadMoreHistory]
  );

  const loadReceivables = useCallback(() => {
    cashApi
      .receivables(establishmentId)
      .then((r) => {
        setReceivables(r.items);
        setReceivablesTotal(r.total);
      })
      .catch(() => {
        setReceivables([]);
        setReceivablesTotal(0);
      });
  }, [establishmentId]);

  const loadProducts = useCallback(() => {
    productApi
      .list(establishmentId)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [establishmentId]);

  useEffect(() => {
    loadCurrent();
    loadHistory();
    loadReceivables();
    loadProducts();
    establishmentApi
      .getOne(establishmentId)
      .then((est) => {
        setAutoEntry(est.cashAutoEntry !== false);
        setEstablishmentName(est.name);
      })
      .catch(() => {
        /* mantém ligado por padrão */
      });
  }, [loadCurrent, loadHistory, loadReceivables, loadProducts, establishmentId]);

  useEffect(() => {
    if (mType === "sangria" || mType === "suprimento") setMMethod("dinheiro");
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
    if ((mType === "saida" || mType === "sangria") && !mDesc.trim()) {
      setError("Informe o motivo da saída/sangria.");
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || "Não foi possível lançar o movimento.");
    } finally {
      setSavingMov(false);
    }
  };

  const breakdownTotal = DENOMS.reduce(
    (s, v) => s + v * (Number(denoms[v]) || 0),
    0
  );

  const doClose = async () => {
    const val = useBreakdown ? breakdownTotal : Number(countedAmount);
    if (isNaN(val) || val < 0) {
      setError("Informe quanto foi contado no caixa.");
      return;
    }
    const breakdown: Denomination[] = useBreakdown
      ? DENOMS.map((v) => ({ value: v, qty: Number(denoms[v]) || 0 })).filter(
          (d) => d.qty > 0
        )
      : [];
    setClosing(true);
    setError(null);
    try {
      await cashApi.close(establishmentId, {
        countedAmount: val,
        closingNotes: closingNotes.trim() || undefined,
        countedBreakdown: breakdown.length ? breakdown : undefined,
      });
      setClosingOpen(false);
      setCountedAmount("");
      setClosingNotes("");
      setDenoms({});
      setUseBreakdown(false);
      loadCurrent();
      loadHistory();
    } catch {
      setError("Não foi possível fechar o caixa.");
    } finally {
      setClosing(false);
    }
  };

  const onSaleDone = (msg: string) => {
    setSaleOpen(false);
    setNotice(msg);
    loadCurrent();
    loadReceivables();
    loadProducts();
  };

  const openReceipt = async (movementId: string) => {
    try {
      const blob = await cashApi.receipt(establishmentId, movementId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("Não foi possível gerar o recibo.");
    }
  };

  const confirmVoid = async () => {
    if (!voiding || !voidReason.trim()) return;
    setActioning(true);
    try {
      const res = await cashApi.void(
        establishmentId,
        voiding._id,
        voidReason.trim()
      );
      setTotals(res.totals);
      setMovements((list) =>
        list.map((m) => (m._id === voiding._id ? res.movement : m))
      );
      setVoiding(null);
      setVoidReason("");
      loadProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || "Não foi possível estornar.");
      setVoiding(null);
    } finally {
      setActioning(false);
    }
  };

  const confirmReceive = async () => {
    if (!receiving) return;
    setActioning(true);
    try {
      await cashApi.receive(establishmentId, receiving._id, [
        { method: receiveMethod, amount: receiving.amount },
      ]);
      setReceiving(null);
      setNotice("Conta recebida e lançada no caixa.");
      loadCurrent();
      loadReceivables();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || "Não foi possível receber a conta.");
      setReceiving(null);
    } finally {
      setActioning(false);
    }
  };

  if (loading && view === "caixa") {
    return (
      <div className="flex items-center gap-3 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando caixa...
      </div>
    );
  }

  const previewCounted = useBreakdown ? breakdownTotal : Number(countedAmount);
  const previewDiff =
    totals && (useBreakdown || countedAmount !== "")
      ? previewCounted - totals.expectedCash
      : null;

  const filtered = movements.filter((m) => {
    if (fType && m.type !== fType) return false;
    if (fMethod && m.method !== fMethod) return false;
    if (fQ) {
      const q = fQ.toLowerCase();
      const hay = `${m.description || ""} ${m.clientName || ""} ${
        m.professionalName || ""
      }`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* sub-abas */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("caixa")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            view === "caixa"
              ? "bg-teal-500 text-white"
              : "bg-ink/5 text-ink/60 hover:bg-ink/10"
          }`}
        >
          Caixa
        </button>
        {isOwner && (
          <button
            onClick={() => setView("relatorios")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              view === "relatorios"
                ? "bg-teal-500 text-white"
                : "bg-ink/5 text-ink/60 hover:bg-ink/10"
            }`}
          >
            Relatórios
          </button>
        )}
      </div>

      {view === "relatorios" ? (
        <CashDashboard establishmentId={establishmentId} />
      ) : (
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

          {!session ? (
            <div className="rounded-2xl border border-ink/10 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-ink">
                Abrir caixa
              </h2>
              <p className="mt-1 text-sm text-ink/60">
                Informe o fundo de troco inicial. Atendimentos concluídos
                pendentes entrarão automaticamente ao abrir.
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
                      {totals
                        ? BRL(totals.expectedCash)
                        : BRL(session.openingAmount)}
                    </p>
                    <p className="text-sm text-teal-100">em dinheiro na gaveta</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSaleOpen(true)}
                      className="rounded-xl bg-white px-5 py-2.5 font-semibold text-teal-700 transition hover:bg-teal-50"
                    >
                      + Nova venda
                    </button>
                    <button
                      onClick={() => setClosingOpen(true)}
                      className="rounded-xl bg-amber-400 px-5 py-2.5 font-semibold text-ink transition hover:bg-amber-500"
                    >
                      Fechar caixa
                    </button>
                  </div>
                </div>

                {totals && (
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-teal-100">Faturamento</p>
                      <p className="font-semibold">{BRL(totals.byType.entrada)}</p>
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

              {/* A receber (fiado em aberto) */}
              {receivables.length > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-ink">
                      A receber (fiado)
                    </h3>
                    <span className="text-sm font-semibold text-amber-700">
                      {BRL(receivablesTotal)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {receivables.map((r) => (
                      <div
                        key={r._id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {r.clientName || r.description || "Venda a prazo"}
                          </p>
                          <p className="text-xs text-ink/50">
                            {r.description}
                            {r.dueDate ? ` · vence ${fmtDate(r.dueDate)}` : ""} ·
                            desde {fmtDate(r.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-ink">
                            {BRL(r.amount)}
                          </span>
                          <button
                            onClick={() => {
                              setReceiveMethod("dinheiro");
                              setReceiving(r);
                            }}
                            disabled={!session}
                            className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
                          >
                            Receber
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!session && (
                    <p className="mt-2 text-xs text-ink/50">
                      Abra o caixa para receber uma conta a prazo.
                    </p>
                  )}
                </div>
              )}

              {/* Lançamento automático */}
              <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white p-4">
                <div>
                  <p className="font-medium text-ink">Lançamento automático</p>
                  <p className="text-sm text-ink/60">
                    Ao concluir um atendimento, lança a entrada no caixa
                    automaticamente.
                  </p>
                </div>
                <button
                  onClick={toggleAutoEntry}
                  disabled={togglingAuto}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
                    autoEntry ? "bg-teal-500" : "bg-ink/20"
                  }`}
                  aria-pressed={autoEntry}
                  aria-label="Alternar lançamento automático"
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      autoEntry ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Movimento manual */}
              <div className="rounded-2xl border border-ink/10 bg-white p-5">
                <h3 className="font-display text-lg font-bold text-ink">
                  Lançar movimento
                </h3>
                <p className="mt-1 text-sm text-ink/60">
                  Para vender serviços/produtos use{" "}
                  <button
                    onClick={() => setSaleOpen(true)}
                    className="font-semibold text-teal-600 hover:underline"
                  >
                    Nova venda
                  </button>
                  . Aqui ficam entradas/saídas avulsas, sangria e suprimento.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(["entrada", "saida", "sangria", "suprimento"] as MovementType[]).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMType(t)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                          mType === t
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
                    Descrição{" "}
                    {mType === "saida" || mType === "sangria"
                      ? "(obrigatória)"
                      : "(opcional)"}
                  </span>
                  <input
                    type="text"
                    value={mDesc}
                    onChange={(e) => setMDesc(e.target.value)}
                    placeholder="Ex: pagamento fornecedor, retirada"
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

              {/* Movimentos */}
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-ink">
                    Movimentos do caixa
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={fType}
                      onChange={(e) => setFType(e.target.value)}
                      className="h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">Todos os tipos</option>
                      <option value="entrada">Entradas</option>
                      <option value="saida">Saídas</option>
                      <option value="sangria">Sangrias</option>
                      <option value="suprimento">Suprimentos</option>
                    </select>
                    <select
                      value={fMethod}
                      onChange={(e) => setFMethod(e.target.value)}
                      className="h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">Todas as formas</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao">Cartão</option>
                      <option value="pix">Pix</option>
                      <option value="outro">Outro</option>
                    </select>
                    <input
                      value={fQ}
                      onChange={(e) => setFQ(e.target.value)}
                      placeholder="Buscar..."
                      className="h-9 w-36 rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
                    {movements.length === 0
                      ? "Nenhum movimento lançado ainda."
                      : "Nenhum movimento com esses filtros."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((m) => {
                      const estornado = m.status === "estornado";
                      const aReceber = m.receivable && !m.paid;
                      return (
                        <div
                          key={m._id}
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                            estornado
                              ? "border-ink/10 bg-ink/[0.03] opacity-70"
                              : "border-ink/10 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLE[m.type]}`}
                            >
                              {TYPE_LABEL[m.type]}
                            </span>
                            <div>
                              <p
                                className={`text-sm font-medium text-ink ${
                                  estornado ? "line-through" : ""
                                }`}
                              >
                                {m.description || TYPE_LABEL[m.type]}
                                {m.clientName ? ` · ${m.clientName}` : ""}
                              </p>
                              <p className="text-xs text-ink/50">
                                {m.payments && m.payments.length > 1
                                  ? m.payments
                                      .map(
                                        (p) =>
                                          `${METHOD_LABEL[p.method]} ${BRL(
                                            p.amount
                                          )}`
                                      )
                                      .join(" + ")
                                  : METHOD_LABEL[m.method]}{" "}
                                · {fmtDateTime(m.createdAt)}
                                {m.professionalName
                                  ? ` · ${m.professionalName}`
                                  : ""}
                                {estornado && m.voidReason
                                  ? ` · estornado: ${m.voidReason}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {aReceber && (
                              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-medium text-amber-700">
                                A receber
                              </span>
                            )}
                            <span
                              className={`font-semibold ${
                                estornado
                                  ? "text-ink/40 line-through"
                                  : isPositive(m.type)
                                  ? "text-teal-600"
                                  : "text-red-600"
                              }`}
                            >
                              {isPositive(m.type) ? "+" : "−"} {BRL(m.amount)}
                            </span>
                            {!estornado && m.type === "entrada" && (
                              <button
                                onClick={() => openReceipt(m._id)}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-teal-600 transition hover:bg-teal-50"
                                title="Recibo"
                              >
                                Recibo
                              </button>
                            )}
                            {!estornado && !aReceber && (
                              <button
                                onClick={() => {
                                  setVoidReason("");
                                  setVoiding(m);
                                }}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
                                title="Estornar"
                              >
                                Estornar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Fechamentos anteriores */}
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
                {historyHasMore && (
                  <div
                    ref={historySentinelRef}
                    className="py-3 text-center text-xs text-ink/40"
                  >
                    {loadingMoreHistory ? "Carregando mais..." : ""}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE FECHAMENTO */}
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

              <div className="rounded-xl border border-ink/10 p-4">
                <p className="text-sm text-ink/70">
                  O sistema espera{" "}
                  <strong className="text-ink">
                    {BRL(totals.expectedCash)}
                  </strong>{" "}
                  em dinheiro na gaveta.
                </p>
                <p className="mt-1 text-xs text-ink/50">
                  Cartão e pix não entram na contagem física — o valor já está na
                  maquininha/banco.
                </p>

                <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink/70">
                  <input
                    type="checkbox"
                    checked={useBreakdown}
                    onChange={(e) => setUseBreakdown(e.target.checked)}
                  />
                  Contar por cédula/moeda
                </label>

                {useBreakdown ? (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {DENOMS.map((v) => (
                        <label
                          key={v}
                          className="flex items-center gap-2 rounded-lg border border-ink/10 px-2 py-1"
                        >
                          <span className="w-14 text-xs text-ink/60">
                            {v >= 1 ? `R$ ${v}` : `${v * 100}¢`}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={denoms[v] ?? ""}
                            onChange={(e) =>
                              setDenoms((d) => ({ ...d, [v]: e.target.value }))
                            }
                            placeholder="0"
                            className="h-8 w-full rounded border border-ink/15 px-2 text-sm outline-none focus:border-teal-500"
                          />
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-ink/70">
                      Total contado:{" "}
                      <strong className="text-ink">{BRL(breakdownTotal)}</strong>
                    </p>
                  </div>
                ) : (
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
                )}

                {previewDiff !== null && (
                  <p
                    className={`mt-2 text-sm font-medium ${
                      previewDiff === 0
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

      {/* MODAL ESTORNO */}
      {voiding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => !actioning && setVoiding(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-ink">
              Estornar movimento
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {voiding.description || TYPE_LABEL[voiding.type]} ·{" "}
              {BRL(voiding.amount)}. O movimento fica registrado como estornado e
              sai dos totais. O estoque dos produtos é devolvido.
            </p>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Motivo (obrigatório)
              </span>
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Ex: valor errado, cliente desistiu"
                className="h-11 w-full rounded-xl border border-ink/15 px-3 outline-none focus:border-teal-500"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmVoid}
                disabled={actioning || !voidReason.trim()}
                className="h-11 flex-1 rounded-xl bg-red-500 px-6 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {actioning ? "Estornando..." : "Confirmar estorno"}
              </button>
              <button
                onClick={() => setVoiding(null)}
                disabled={actioning}
                className="h-11 rounded-xl border border-ink/15 px-5 font-medium text-ink/70 transition hover:bg-sand"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECEBER FIADO */}
      {receiving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => !actioning && setReceiving(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-ink">
              Receber conta
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {receiving.clientName || receiving.description} ·{" "}
              <strong className="text-ink">{BRL(receiving.amount)}</strong>.
              Entra como entrada no caixa aberto.
            </p>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                Forma de pagamento
              </span>
              <select
                value={receiveMethod}
                onChange={(e) =>
                  setReceiveMethod(e.target.value as PaymentMethod)
                }
                className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="pix">Pix</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmReceive}
                disabled={actioning}
                className="h-11 flex-1 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
              >
                {actioning ? "Recebendo..." : "Confirmar recebimento"}
              </button>
              <button
                onClick={() => setReceiving(null)}
                disabled={actioning}
                className="h-11 rounded-xl border border-ink/15 px-5 font-medium text-ink/70 transition hover:bg-sand"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA VENDA */}
      {saleOpen && (
        <NewSaleModal
          establishmentId={establishmentId}
          products={products}
          onClose={() => setSaleOpen(false)}
          onDone={onSaleDone}
        />
      )}

      {/* MODAL RELATÓRIO */}
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
