import { useCallback, useEffect, useState } from "react";
import { cashApi, DashboardData, CashMovement } from "../api/cash";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "Pix",
  outro: "Outro",
};
const TYPE_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  sangria: "Sangria",
  suprimento: "Suprimento",
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export function CashDashboard({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [from, setFrom] = useState(ymd(monthStart));
  const [to, setTo] = useState(ymd(today));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    cashApi
      .dashboard(establishmentId, { from, to })
      .then(setData)
      .catch((e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response
          ?.status;
        setError(
          status === 403
            ? "Apenas o dono acessa o painel financeiro."
            : "Não foi possível carregar o painel."
        );
      })
      .finally(() => setLoading(false));
  }, [establishmentId, from, to]);

  useEffect(load, [load]);

  const preset = (days: number) => {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - (days - 1));
    setFrom(ymd(f));
    setTo(ymd(t));
  };
  const presetMonth = () => {
    const t = new Date();
    setFrom(ymd(new Date(t.getFullYear(), t.getMonth(), 1)));
    setTo(ymd(t));
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: CashMovement[] = [];
      let page = 1;
      // pega até ~1000 movimentos do período
      for (let i = 0; i < 20; i++) {
        const res = await cashApi.movements(establishmentId, {
          from,
          to,
          page,
        });
        rows.push(...res.movements);
        if (!res.hasMore) break;
        page += 1;
      }
      const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const header = [
        "Data",
        "Tipo",
        "Descrição",
        "Cliente",
        "Profissional",
        "Forma",
        "Valor",
        "Status",
      ];
      const lines = rows.map((m) =>
        [
          new Date(m.createdAt).toLocaleString("pt-BR"),
          TYPE_LABEL[m.type] || m.type,
          m.description || "",
          m.clientName || "",
          m.professionalName || "",
          METHOD_LABEL[m.method] || m.method,
          String(m.amount).replace(".", ","),
          m.status === "estornado"
            ? "Estornado"
            : m.receivable && !m.paid
            ? "A receber"
            : "OK",
        ]
          .map(esc)
          .join(";")
      );
      const csv = [header.map(esc).join(";"), ...lines].join("\n");
      // BOM (﻿) para o Excel abrir os acentos em UTF-8 corretamente
      const blob = new Blob(["﻿" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caixa_${from}_a_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Não foi possível exportar o CSV.");
    } finally {
      setExporting(false);
    }
  };

  const maxDay = data
    ? Math.max(1, ...data.byDay.map((d) => d.total))
    : 1;

  return (
    <div className="space-y-6">
      {/* filtros de período */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-4">
        <div className="flex gap-2">
          <button
            onClick={() => preset(1)}
            className="rounded-lg bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/10"
          >
            Hoje
          </button>
          <button
            onClick={() => preset(7)}
            className="rounded-lg bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/10"
          >
            7 dias
          </button>
          <button
            onClick={presetMonth}
            className="rounded-lg bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/10"
          >
            Este mês
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">De</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <button
          onClick={exportCsv}
          disabled={exporting || !data}
          className="ml-auto h-9 rounded-lg border border-ink/15 px-4 text-sm font-semibold text-ink/70 transition hover:bg-sand disabled:opacity-50"
        >
          {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando painel...
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl bg-teal-700 p-4 text-white">
              <p className="text-xs text-teal-100">Faturamento</p>
              <p className="mt-1 text-2xl font-bold">{BRL(data.revenue)}</p>
              <p className="text-xs text-teal-100">{data.salesCount} venda(s)</p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white p-4">
              <p className="text-xs text-ink/50">Ticket médio</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {BRL(data.ticket)}
              </p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white p-4">
              <p className="text-xs text-ink/50">Saídas / sangrias</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {BRL(data.outflow)}
              </p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white p-4">
              <p className="text-xs text-ink/50">A receber (fiado)</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {BRL(data.receivables.total)}
              </p>
              <p className="text-xs text-ink/40">
                {data.receivables.count} conta(s)
              </p>
            </div>
          </div>

          {(data.fees > 0 || data.discounts > 0 || data.netRevenue !== data.revenue) && (
            <p className="text-sm text-ink/60">
              Faturamento líquido (menos taxas de cartão):{" "}
              <strong className="text-ink">{BRL(data.netRevenue)}</strong>
              {data.fees > 0 && ` · taxas ${BRL(data.fees)}`}
              {data.discounts > 0 && ` · descontos ${BRL(data.discounts)}`}
            </p>
          )}

          {/* gráfico por dia */}
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <h3 className="mb-4 font-display text-lg font-bold text-ink">
              Faturamento por dia
            </h3>
            {data.byDay.length === 0 ? (
              <p className="text-sm text-ink/40">Sem entradas no período.</p>
            ) : (
              <div className="flex items-end gap-1.5 overflow-x-auto pb-2">
                {data.byDay.map((d) => (
                  <div
                    key={d.date}
                    className="flex min-w-[28px] flex-1 flex-col items-center gap-1"
                    title={`${shortDay(d.date)}: ${BRL(d.total)}`}
                  >
                    <div className="flex h-40 w-full items-end">
                      <div
                        className="w-full rounded-t bg-teal-500"
                        style={{
                          height: `${Math.max(4, (d.total / maxDay) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-ink/50">
                      {shortDay(d.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* por forma */}
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h3 className="mb-3 font-display text-lg font-bold text-ink">
                Por forma de pagamento
              </h3>
              <div className="space-y-2">
                {(["dinheiro", "cartao", "pix", "outro"] as const).map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-ink/70">{METHOD_LABEL[k]}</span>
                    <span className="font-semibold text-ink">
                      {BRL(data.byMethod[k])}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* por profissional */}
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h3 className="mb-3 font-display text-lg font-bold text-ink">
                Por profissional
              </h3>
              {data.byProfessional.length === 0 ? (
                <p className="text-sm text-ink/40">Sem dados.</p>
              ) : (
                <div className="space-y-2">
                  {data.byProfessional.map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-ink/70">
                        {p.name}{" "}
                        <span className="text-ink/40">({p.count})</span>
                      </span>
                      <span className="font-semibold text-ink">
                        {BRL(p.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* top itens */}
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <h3 className="mb-3 font-display text-lg font-bold text-ink">
              Mais vendidos
            </h3>
            {data.topItems.length === 0 ? (
              <p className="text-sm text-ink/40">Sem itens vendidos.</p>
            ) : (
              <div className="space-y-2">
                {data.topItems.map((it, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink/70">
                      {it.name}
                      <span className="ml-1 text-xs text-ink/40">
                        {it.kind === "servico"
                          ? "serviço"
                          : it.kind === "produto"
                          ? "produto"
                          : "avulso"}{" "}
                        · {it.qty}x
                      </span>
                    </span>
                    <span className="font-semibold text-ink">{BRL(it.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
