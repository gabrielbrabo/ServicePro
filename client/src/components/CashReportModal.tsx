import { CashSession, ReportLine } from "../api/cash";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const TYPE_LABEL: Record<ReportLine["type"], string> = {
  entrada: "Entrada",
  saida: "Saída",
  sangria: "Sangria",
  suprimento: "Suprimento",
};

const METHOD_LABEL: Record<ReportLine["method"], string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "Pix",
  outro: "Outro",
};

const isPositive = (t: ReportLine["type"]) =>
  t === "entrada" || t === "suprimento";

const personName = (v: unknown): string =>
  typeof v === "object" && v !== null && "name" in (v as object)
    ? String((v as { name: string }).name)
    : "";

export function CashReportModal({
  session,
  establishmentName,
  onClose,
}: {
  session: CashSession;
  establishmentName?: string;
  onClose: () => void;
}) {
  const r = session.report;

  const handlePrint = () => window.print();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none"
      onClick={onClose}
    >
      {/* estilos de impressão: esconde tudo menos o relatório */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #cash-report, #cash-report * { visibility: visible !important; }
          #cash-report {
            position: absolute !important;
            left: 0; top: 0;
            width: 100% !important;
            max-height: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        id="cash-report"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl print:max-w-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-6">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              Relatório de fechamento de caixa
            </h2>
            {establishmentName && (
              <p className="text-sm text-ink/60">{establishmentName}</p>
            )}
            <p className="mt-1 text-sm text-ink/60">
              Aberto em {fmtDateTime(session.openedAt)}
              {session.closedAt && <> · Fechado em {fmtDateTime(session.closedAt)}</>}
            </p>
            {(personName(session.openedBy) || personName(session.closedBy)) && (
              <p className="text-xs text-ink/50">
                {personName(session.openedBy) &&
                  `Abertura: ${personName(session.openedBy)}`}
                {personName(session.closedBy) &&
                  ` · Fechamento: ${personName(session.closedBy)}`}
              </p>
            )}
          </div>
          <div className="flex gap-2 no-print">
            <button
              onClick={handlePrint}
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
            >
              Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 print:overflow-visible">
          {!r ? (
            <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
              Este fechamento não tem relatório detalhado (foi feito antes desta
              funcionalidade).
            </p>
          ) : (
            <div className="space-y-6">
              {/* Conferência do dinheiro */}
              <section>
                <h3 className="mb-2 font-display font-bold text-ink">
                  Conferência (dinheiro)
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-sand/60 p-3">
                    <p className="text-xs text-ink/50">Abertura</p>
                    <p className="font-semibold text-ink">
                      {BRL(r.openingAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sand/60 p-3">
                    <p className="text-xs text-ink/50">Esperado</p>
                    <p className="font-semibold text-ink">
                      {BRL(r.expectedCash)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sand/60 p-3">
                    <p className="text-xs text-ink/50">Contado</p>
                    <p className="font-semibold text-ink">
                      {BRL(r.countedAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sand/60 p-3">
                    <p className="text-xs text-ink/50">Diferença</p>
                    <p
                      className={`font-semibold ${
                        r.difference === 0
                          ? "text-ink"
                          : r.difference > 0
                          ? "text-teal-600"
                          : "text-red-600"
                      }`}
                    >
                      {r.difference === 0
                        ? "Bateu certo"
                        : r.difference > 0
                        ? `+ ${BRL(r.difference)}`
                        : `− ${BRL(Math.abs(r.difference))}`}
                    </p>
                  </div>
                </div>
              </section>

              {/* Totais por forma de pagamento */}
              <section>
                <h3 className="mb-2 font-display font-bold text-ink">
                  Por forma de pagamento
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["Dinheiro", r.byMethod.dinheiro],
                      ["Cartão", r.byMethod.cartao],
                      ["Pix", r.byMethod.pix],
                      ["Outro", r.byMethod.outro],
                    ] as [string, number][]
                  ).map(([label, val]) => (
                    <div key={label} className="rounded-xl bg-sand/60 p-3">
                      <p className="text-xs text-ink/50">{label}</p>
                      <p className="font-semibold text-ink">{BRL(val)}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Totais por tipo */}
              <section>
                <h3 className="mb-2 font-display font-bold text-ink">
                  Por tipo de movimento
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["Entradas", r.byType.entrada],
                      ["Saídas", r.byType.saida],
                      ["Sangrias", r.byType.sangria],
                      ["Suprimentos", r.byType.suprimento],
                    ] as [string, number][]
                  ).map(([label, val]) => (
                    <div key={label} className="rounded-xl bg-sand/60 p-3">
                      <p className="text-xs text-ink/50">{label}</p>
                      <p className="font-semibold text-ink">{BRL(val)}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-ink/70">
                  Faturamento total (entradas):{" "}
                  <strong className="text-ink">{BRL(r.totalRevenue)}</strong> ·{" "}
                  {r.movementCount} movimento
                  {r.movementCount !== 1 ? "s" : ""}
                </p>
              </section>

              {/* Detalhamento */}
              <section>
                <h3 className="mb-2 font-display font-bold text-ink">
                  Detalhamento dos movimentos
                </h3>
                {r.lines.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
                    Nenhum movimento nesta sessão.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-ink/10 text-xs uppercase text-ink/50">
                          <th className="py-2 pr-3">Data/hora</th>
                          <th className="py-2 pr-3">Descrição</th>
                          <th className="py-2 pr-3">Profissional</th>
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="py-2 pr-3">Forma</th>
                          <th className="py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.lines.map((l, i) => (
                          <tr
                            key={i}
                            className="border-b border-ink/5 align-top"
                          >
                            <td className="py-2 pr-3 text-ink/70">
                              {fmtDateTime(l.createdAt)}
                            </td>
                            <td className="py-2 pr-3 text-ink">
                              {l.description || TYPE_LABEL[l.type]}
                            </td>
                            <td className="py-2 pr-3 text-ink/70">
                              {l.professionalName || "—"}
                            </td>
                            <td className="py-2 pr-3 text-ink/70">
                              {TYPE_LABEL[l.type]}
                            </td>
                            <td className="py-2 pr-3 text-ink/70">
                              {METHOD_LABEL[l.method]}
                            </td>
                            <td
                              className={`py-2 text-right font-medium ${
                                isPositive(l.type)
                                  ? "text-teal-600"
                                  : "text-red-600"
                              }`}
                            >
                              {isPositive(l.type) ? "+" : "−"} {BRL(l.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {session.closingNotes && (
                <section>
                  <h3 className="mb-1 font-display font-bold text-ink">
                    Observações do fechamento
                  </h3>
                  <p className="text-sm text-ink/70">{session.closingNotes}</p>
                </section>
              )}

              <p className="text-xs text-ink/40">
                Relatório gerado em {fmtDateTime(r.generatedAt)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}