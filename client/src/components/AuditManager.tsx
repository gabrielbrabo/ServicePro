import { useEffect, useState } from "react";
import { auditApi, AuditEntry, AuditPage } from "../api/audit";

const RESOURCE_LABEL: Record<string, string> = {
  prontuario: "Prontuário",
  odontograma: "Odontograma",
  plano_tratamento: "Plano de tratamento",
  documento: "Documento",
};

const ACTION_LABEL: Record<string, string> = {
  view: "Consultou",
  create: "Criou",
  update: "Alterou",
  delete: "Removeu",
  other: "Outro",
};

const ACTION_STYLE: Record<string, string> = {
  view: "bg-ink/5 text-ink/60",
  create: "bg-teal-50 text-teal-700",
  update: "bg-amber-400/20 text-amber-700",
  delete: "bg-red-50 text-red-600",
  other: "bg-ink/5 text-ink/60",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Aba "Auditoria" (só o dono): trilha de acesso/alteração de dados de paciente (LGPD).
export function AuditManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [resource, setResource] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    auditApi
      .list(establishmentId, {
        resource: resource || undefined,
        action: action || undefined,
        page,
        limit: 50,
      })
      .then(setData)
      .catch(() => setError("Não foi possível carregar a auditoria."))
      .finally(() => setLoading(false));
  }, [establishmentId, resource, action, page]);

  const selCls =
    "h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";

  const who = (e: AuditEntry) => e.actor?.name || "Usuário removido";
  const patient = (e: AuditEntry) => e.client?.name || "—";

  return (
    <div>
      <p className="text-sm text-ink/50">
        Registro de quem acessou ou alterou dados de pacientes (LGPD). Apenas o
        dono vê esta aba.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Tipo de dado
          </span>
          <select
            value={resource}
            onChange={(e) => {
              setResource(e.target.value);
              setPage(1);
            }}
            className={selCls}
          >
            <option value="">Todos</option>
            <option value="prontuario">Prontuário</option>
            <option value="odontograma">Odontograma</option>
            <option value="plano_tratamento">Plano de tratamento</option>
            <option value="documento">Documento</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Ação
          </span>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className={selCls}
          >
            <option value="">Todas</option>
            <option value="view">Consulta</option>
            <option value="create">Criação</option>
            <option value="update">Alteração</option>
            <option value="delete">Remoção</option>
          </select>
        </label>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando registros...
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-ink/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sand/50 text-left text-xs uppercase tracking-wide text-ink/50">
                  <th className="px-4 py-3 font-semibold">Data / hora</th>
                  <th className="px-4 py-3 font-semibold">Quem</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                  <th className="px-4 py-3 font-semibold">Tipo de dado</th>
                  <th className="px-4 py-3 font-semibold">Paciente</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e._id} className="border-t border-ink/10">
                    <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                      {fmt(e.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{who(e)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          ACTION_STYLE[e.action] || ACTION_STYLE.other
                        }`}
                      >
                        {ACTION_LABEL[e.action] || e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {RESOURCE_LABEL[e.resource] || e.resource}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{patient(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-ink/60">
            <span>
              {data.total} registro{data.total !== 1 ? "s" : ""} · página{" "}
              {data.page} de {data.pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="rounded-lg border border-ink/15 px-3 py-1.5 font-medium text-ink/70 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.page >= data.pages}
                className="rounded-lg border border-ink/15 px-3 py-1.5 font-medium text-ink/70 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhum registro de acesso ainda.
        </div>
      )}
    </div>
  );
}
