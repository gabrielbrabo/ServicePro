import { useEffect, useState } from "react";
import {
  commissionApi,
  CommissionService,
  CommissionReport,
} from "../api/commission";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Aba "Comissões". Dono: Relatório (todos) + Taxas por serviço.
// Funcionário: só o Relatório com a própria comissão (sem as taxas).
export function CommissionsManager({
  establishmentId,
  isOwner = true,
}: {
  establishmentId: string;
  isOwner?: boolean;
}) {
  const [view, setView] = useState<"relatorio" | "taxas">("relatorio");

  // funcionário: só o relatório da própria comissão, sem sub-abas
  if (!isOwner) {
    return (
      <div>
        <h3 className="mb-4 font-display text-lg font-bold text-ink">
          Minhas comissões
        </h3>
        <Report establishmentId={establishmentId} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-ink/10">
        {(
          [
            ["relatorio", "Relatório"],
            ["taxas", "Taxas por serviço"],
          ] as ["relatorio" | "taxas", string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              view === key
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-ink/50 hover:text-ink/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "relatorio" ? (
        <Report establishmentId={establishmentId} />
      ) : (
        <Rates establishmentId={establishmentId} />
      )}
    </div>
  );
}

// ---- Relatório por profissional ----
function Report({ establishmentId }: { establishmentId: string }) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [from, setFrom] = useState(toYMD(monthStart));
  const [to, setTo] = useState(toYMD(today));
  const [data, setData] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    commissionApi
      .getReport(establishmentId, { from, to })
      .then(setData)
      .catch(() => setError("Não foi possível carregar o relatório."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId]);

  const inputCls =
    "h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">De</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputCls}
          />
        </label>
        <button
          onClick={load}
          className="h-10 rounded-lg bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          Atualizar
        </button>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Calculando comissões...
        </div>
      ) : data && data.professionals.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-ink/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand/50 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3 font-semibold">Profissional</th>
                <th className="px-4 py-3 text-right font-semibold">Atend.</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Base recebida
                </th>
                <th className="px-4 py-3 text-right font-semibold">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {data.professionals.map((r) => (
                <tr
                  key={r.professionalId || "none"}
                  className="border-t border-ink/10"
                >
                  <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                  <td className="px-4 py-3 text-right text-ink/70">{r.count}</td>
                  <td className="px-4 py-3 text-right text-ink/70">
                    {brl(r.base)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-600">
                    {brl(r.commission)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink/15 bg-sand/30 font-bold text-ink">
                <td className="px-4 py-3">Total ({data.totals.count})</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">{brl(data.totals.base)}</td>
                <td className="px-4 py-3 text-right text-teal-600">
                  {brl(data.totals.commission)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum atendimento concluído e pago no período.
        </div>
      )}
    </div>
  );
}

// ---- Taxas por serviço ----
function Rates({ establishmentId }: { establishmentId: string }) {
  const [services, setServices] = useState<CommissionService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    commissionApi
      .getConfig(establishmentId)
      .then(setServices)
      .catch(() => setError("Não foi possível carregar os serviços."))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  const setPercent = (id: string, value: string) => {
    let p = Number(value);
    if (!Number.isFinite(p)) p = 0;
    p = Math.min(100, Math.max(0, p));
    setServices((list) =>
      list.map((s) => (s._id === id ? { ...s, percent: p } : s))
    );
    setSavedMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await commissionApi.setConfig(
        establishmentId,
        services.map((s) => ({ service: s._id, percent: s.percent }))
      );
      setSavedMsg("Taxas salvas.");
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando serviços...
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-ink/50">
        Defina a % de comissão de cada serviço. A comissão incide sobre o valor
        recebido, apenas em atendimentos concluídos e pagos.
      </p>

      {services.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum serviço ativo cadastrado.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {services.map((s) => (
            <div
              key={s._id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{s.title}</p>
                <p className="text-xs text-ink/50">
                  {brl(s.price)} · comissão ={" "}
                  {brl((s.price * s.percent) / 100)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={s.percent}
                  onChange={(e) => setPercent(s._id, e.target.value)}
                  className="h-10 w-20 rounded-lg border border-ink/15 bg-white px-3 text-right text-sm outline-none focus:border-teal-500"
                />
                <span className="text-sm text-ink/50">%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}
      {savedMsg && (
        <p className="mt-4 text-sm font-medium text-teal-600">{savedMsg}</p>
      )}

      {services.length > 0 && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar taxas"}
        </button>
      )}
    </div>
  );
}