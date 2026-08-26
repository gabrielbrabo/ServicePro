import { useEffect, useMemo, useState } from "react";
import {
  convenioApi,
  HealthPlan,
  TussServiceRow,
  Claim,
  ClaimProcedure,
  ProcedureStatus,
  TissConfig,
  TissXmlResult,
} from "../api/convenio";
import { recordApi, EstablishmentClient } from "../api/medicalRecord";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  glosado: "Glosado",
};
const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-amber-400/20 text-amber-700",
  pago: "bg-teal-50 text-teal-700",
  glosado: "bg-red-50 text-red-600",
};

function claimTotals(procs: ClaimProcedure[]) {
  let total = 0,
    pago = 0,
    glosado = 0,
    pendente = 0;
  for (const p of procs) {
    const v = (p.quantity || 1) * (p.unitValue || 0);
    total += v;
    if (p.status === "pago") pago += v;
    else if (p.status === "glosado") glosado += v;
    else pendente += v;
  }
  return { total, pago, glosado, pendente };
}

const planName = (c: Claim): string =>
  typeof c.healthPlan === "object" ? c.healthPlan.name : "—";
const clientName = (c: Claim): string =>
  typeof c.client === "object" ? c.client.name : "—";

export function ConvenioManager({
  establishmentId,
  isOwner = true,
}: {
  establishmentId: string;
  isOwner?: boolean;
}) {
  type View = "guias" | "convenios" | "tuss" | "tissconfig";
  const [view, setView] = useState<View>("guias");

  const tabs: [View, string][] = [
    ["guias", "Guias"],
    ...((isOwner
      ? [
          ["convenios", "Convênios"],
          ["tuss", "Códigos TUSS"],
          ["tissconfig", "Config TISS"],
        ]
      : []) as [View, string][]),
  ];

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-ink/10">
        {tabs.map(([key, label]) => (
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

      {view === "guias" && <Guias establishmentId={establishmentId} />}
      {view === "convenios" && isOwner && (
        <Convenios establishmentId={establishmentId} />
      )}
      {view === "tuss" && isOwner && <Tuss establishmentId={establishmentId} />}
      {view === "tissconfig" && isOwner && (
        <TissConfigForm establishmentId={establishmentId} />
      )}
    </div>
  );
}

// ================= GUIAS =================
function Guias({ establishmentId }: { establishmentId: string }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [fPlan, setFPlan] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [editing, setEditing] = useState<Claim | "new" | null>(null);

  const load = () => {
    setLoading(true);
    convenioApi
      .listClaims(establishmentId, {
        healthPlan: fPlan || undefined,
        status: fStatus || undefined,
      })
      .then(setClaims)
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    convenioApi
      .listPlans(establishmentId)
      .then(setPlans)
      .catch(() => setPlans([]));
  }, [establishmentId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, fPlan, fStatus]);

  if (editing) {
    return (
      <GuideForm
        establishmentId={establishmentId}
        plans={plans}
        claim={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  const selCls =
    "h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={fPlan} onChange={(e) => setFPlan(e.target.value)} className={selCls}>
            <option value="">Todos os convênios</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls}>
            <option value="">Todos os status</option>
            <option value="pendente">Com pendente</option>
            <option value="pago">Com pago</option>
            <option value="glosado">Com glosado</option>
          </select>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="h-10 rounded-lg bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Nova guia
        </button>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando guias...
        </div>
      ) : claims.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">
          Nenhuma guia lançada ainda.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-ink/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand/50 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Paciente</th>
                <th className="px-4 py-3 font-semibold">Convênio</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Pago</th>
                <th className="px-4 py-3 text-right font-semibold">Glosado</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => {
                const t = claimTotals(c.procedures);
                return (
                  <tr
                    key={c._id}
                    onClick={() => setEditing(c)}
                    className="cursor-pointer border-t border-ink/10 hover:bg-sand/30"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                      {fmtDate(c.date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{clientName(c)}</td>
                    <td className="px-4 py-3 text-ink/70">{planName(c)}</td>
                    <td className="px-4 py-3 text-right text-ink/80">{brl(t.total)}</td>
                    <td className="px-4 py-3 text-right text-teal-600">{brl(t.pago)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{brl(t.glosado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- Formulário de guia (criar/editar) ----
function GuideForm({
  establishmentId,
  plans,
  claim,
  onClose,
  onSaved,
}: {
  establishmentId: string;
  plans: HealthPlan[];
  claim: Claim | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [patients, setPatients] = useState<EstablishmentClient[]>([]);
  const [services, setServices] = useState<TussServiceRow[]>([]);

  const [client, setClient] = useState(
    claim && typeof claim.client === "object" ? claim.client._id : ""
  );
  const [healthPlan, setHealthPlan] = useState(
    claim && typeof claim.healthPlan === "object" ? claim.healthPlan._id : ""
  );
  const [cardNumber, setCardNumber] = useState(claim?.cardNumber || "");
  const [guideNumber, setGuideNumber] = useState(claim?.guideNumber || "");
  const [date, setDate] = useState(
    claim ? ymd(new Date(claim.date)) : ymd(new Date())
  );
  const [procs, setProcs] = useState<ClaimProcedure[]>(
    claim ? claim.procedures.map((p) => ({ ...p })) : []
  );
  const [notes, setNotes] = useState(claim?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    recordApi.clients(establishmentId).then(setPatients).catch(() => setPatients([]));
    convenioApi.getTuss(establishmentId).then(setServices).catch(() => setServices([]));
  }, [establishmentId]);

  // ao escolher paciente+convênio, tenta puxar a carteirinha salva
  useEffect(() => {
    if (!client || !healthPlan || claim) return;
    convenioApi
      .listCards(establishmentId, client)
      .then((cards) => {
        const c = cards.find((x) =>
          typeof x.healthPlan === "object"
            ? x.healthPlan._id === healthPlan
            : x.healthPlan === healthPlan
        );
        if (c) setCardNumber((cur) => cur || c.number);
      })
      .catch(() => undefined);
  }, [client, healthPlan, establishmentId, claim]);

  const totals = useMemo(() => claimTotals(procs), [procs]);

  const addBlank = () =>
    setProcs((p) => [
      ...p,
      { tussCode: "", description: "", quantity: 1, unitValue: 0, status: "pendente" },
    ]);

  const addFromService = (serviceId: string) => {
    const s = services.find((x) => x._id === serviceId);
    if (!s) return;
    setProcs((p) => [
      ...p,
      {
        tussCode: s.code || "",
        description: s.description || s.title,
        quantity: 1,
        unitValue: 0,
        status: "pendente",
      },
    ]);
  };

  const setProc = (i: number, patch: Partial<ClaimProcedure>) =>
    setProcs((list) => list.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removeProc = (i: number) =>
    setProcs((list) => list.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!client || !healthPlan) {
      setError("Escolha o paciente e o convênio.");
      return;
    }
    const valid = procs.filter((p) => p.tussCode.trim());
    if (valid.length === 0) {
      setError("Inclua ao menos um procedimento com código TUSS.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        client,
        healthPlan,
        cardNumber: cardNumber.trim() || undefined,
        guideNumber: guideNumber.trim() || undefined,
        date,
        procedures: valid,
        notes: notes.trim() || undefined,
      };
      if (claim) await convenioApi.updateClaim(establishmentId, claim._id, payload);
      else await convenioApi.createClaim(establishmentId, payload);
      onSaved();
    } catch {
      setError("Não foi possível salvar a guia.");
      setSaving(false);
    }
  };

  const del = async () => {
    if (!claim) return;
    setSaving(true);
    try {
      await convenioApi.deleteClaim(establishmentId, claim._id);
      onSaved();
    } catch {
      setError("Não foi possível remover.");
      setSaving(false);
    }
  };

  const [genMsg, setGenMsg] = useState<string | null>(null);
  const generateXml = async (kind: "consulta" | "sadt") => {
    if (!claim) return;
    setGenMsg(null);
    setError(null);
    try {
      const res: TissXmlResult =
        kind === "sadt"
          ? await convenioApi.generateSadtXml(establishmentId, claim._id)
          : await convenioApi.generateXml(establishmentId, claim._id);
      // baixa o .xml
      const blob = new Blob([res.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guia-${kind}-${claim.guideNumber || claim._id}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setGenMsg(
        res.warnings.length
          ? `XML gerado. Faltam preencher (Config TISS): ${res.warnings.join(", ")}.`
          : "XML gerado e baixado. Valide no validador TISS antes de enviar."
      );
    } catch {
      setError("Não foi possível gerar o XML.");
    }
  };

  const inputCls =
    "h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";

  return (
    <div>
      <button
        onClick={onClose}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:underline"
      >
        ← Voltar às guias
      </button>

      <h3 className="font-display text-lg font-bold text-ink">
        {claim ? "Editar guia" : "Nova guia"}
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Paciente</span>
          <select value={client} onChange={(e) => setClient(e.target.value)} className={inputCls}>
            <option value="">Selecione...</option>
            {patients.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Convênio</span>
          <select value={healthPlan} onChange={(e) => setHealthPlan(e.target.value)} className={inputCls}>
            <option value="">Selecione...</option>
            {plans.filter((p) => p.active).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Carteirinha</span>
          <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} className={inputCls} placeholder="Número" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Nº da guia (opcional)</span>
          <input value={guideNumber} onChange={(e) => setGuideNumber(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Data do atendimento</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
      </div>

      {/* Procedimentos */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display font-bold text-ink">Procedimentos</h4>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) addFromService(e.target.value);
                e.target.value = "";
              }}
              className="h-9 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
              defaultValue=""
            >
              <option value="">+ do serviço...</option>
              {services.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title}
                  {s.code ? ` (${s.code})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addBlank}
              className="h-9 rounded-lg border border-dashed border-ink/25 px-3 text-sm font-medium text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
            >
              + em branco
            </button>
          </div>
        </div>

        {procs.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
            Nenhum procedimento. Adicione a partir de um serviço ou em branco.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {procs.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-white p-3 sm:grid-cols-12 sm:items-end"
              >
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-medium text-ink/50">TUSS</span>
                  <input value={p.tussCode} onChange={(e) => setProc(i, { tussCode: e.target.value })} className="h-9 w-full rounded-lg border border-ink/15 px-2 text-sm outline-none focus:border-teal-500" />
                </label>
                <label className="block sm:col-span-4">
                  <span className="mb-1 block text-[11px] font-medium text-ink/50">Descrição</span>
                  <input value={p.description || ""} onChange={(e) => setProc(i, { description: e.target.value })} className="h-9 w-full rounded-lg border border-ink/15 px-2 text-sm outline-none focus:border-teal-500" />
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-1 block text-[11px] font-medium text-ink/50">Qtd</span>
                  <input type="number" min="1" value={p.quantity} onChange={(e) => setProc(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="h-9 w-full rounded-lg border border-ink/15 px-2 text-sm outline-none focus:border-teal-500" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-medium text-ink/50">Valor un.</span>
                  <input type="number" min="0" step="0.01" value={p.unitValue} onChange={(e) => setProc(i, { unitValue: Math.max(0, Number(e.target.value) || 0) })} className="h-9 w-full rounded-lg border border-ink/15 px-2 text-sm outline-none focus:border-teal-500" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-medium text-ink/50">Status</span>
                  <select value={p.status} onChange={(e) => setProc(i, { status: e.target.value as ProcedureStatus })} className="h-9 w-full rounded-lg border border-ink/15 px-2 text-sm outline-none focus:border-teal-500">
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="glosado">Glosado</option>
                  </select>
                </label>
                <div className="sm:col-span-1 sm:pb-1">
                  <button type="button" onClick={() => removeProc(i)} className="text-sm font-medium text-red-500 hover:underline">
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {procs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-ink/60">Total: <b className="text-ink">{brl(totals.total)}</b></span>
            <span className="text-teal-600">Pago: <b>{brl(totals.pago)}</b></span>
            <span className="text-red-500">Glosado: <b>{brl(totals.glosado)}</b></span>
            <span className="text-amber-600">Pendente: <b>{brl(totals.pendente)}</b></span>
          </div>
        )}
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium text-ink/60">Observações</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" />
      </label>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}
      {genMsg && <p className="mt-3 text-sm font-medium text-teal-600">{genMsg}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {claim && (
            <button onClick={del} disabled={saving} className="text-sm font-medium text-red-500 hover:underline disabled:opacity-50">
              Excluir guia
            </button>
          )}
          {claim && (
            <button onClick={() => generateXml("consulta")} className="text-sm font-medium text-teal-600 hover:underline">
              XML Consulta
            </button>
          )}
          {claim && (
            <button onClick={() => generateXml("sadt")} className="text-sm font-medium text-teal-600 hover:underline">
              XML SP/SADT
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving} className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-teal-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar guia"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ================= CONVÊNIOS =================
function Convenios({ establishmentId }: { establishmentId: string }) {
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [ans, setAns] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    convenioApi.listPlans(establishmentId).then(setPlans).catch(() => setPlans([])).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId]);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await convenioApi.createPlan(establishmentId, { name: name.trim(), ansRegistry: ans.trim() || undefined });
      setName("");
      setAns("");
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: HealthPlan) => {
    await convenioApi.updatePlan(establishmentId, p._id, { active: !p.active });
    load();
  };
  const remove = async (p: HealthPlan) => {
    await convenioApi.deletePlan(establishmentId, p._id);
    load();
  };

  const inputCls = "h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";

  return (
    <div>
      <p className="text-sm text-ink/50">Convênios / operadoras que este estabelecimento atende.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Nome do convênio</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ex: Unimed" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Registro ANS (opcional)</span>
          <input value={ans} onChange={(e) => setAns(e.target.value)} className={inputCls} />
        </label>
        <button onClick={add} disabled={saving || !name.trim()} className="h-10 rounded-lg bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50">
          Adicionar
        </button>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando...
        </div>
      ) : plans.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">Nenhum convênio cadastrado.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {plans.map((p) => (
            <div key={p._id} className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3">
              <div>
                <p className={`font-medium ${p.active ? "text-ink" : "text-ink/40 line-through"}`}>{p.name}</p>
                {p.ansRegistry && <p className="text-xs text-ink/50">ANS {p.ansRegistry}</p>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button onClick={() => toggle(p)} className="font-medium text-ink/60 hover:text-ink">
                  {p.active ? "Desativar" : "Ativar"}
                </button>
                <button onClick={() => remove(p)} className="font-medium text-red-500 hover:underline">
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================= CÓDIGOS TUSS =================
function Tuss({ establishmentId }: { establishmentId: string }) {
  const [rows, setRows] = useState<TussServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    convenioApi.getTuss(establishmentId).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [establishmentId]);

  const set = (id: string, patch: Partial<TussServiceRow>) => {
    setRows((list) => list.map((r) => (r._id === id ? { ...r, ...patch } : r)));
    setSavedMsg(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await convenioApi.setTuss(
        establishmentId,
        rows.map((r) => ({ service: r._id, code: r.code, description: r.description }))
      );
      setSavedMsg("Códigos salvos.");
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
      <p className="text-sm text-ink/50">Código TUSS padrão de cada serviço. Serve de sugestão ao lançar guias (dá para trocar na guia).</p>
      {rows.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink/50">Nenhum serviço ativo cadastrado.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r._id} className="grid grid-cols-1 gap-2 rounded-xl border border-ink/10 bg-white p-3 sm:grid-cols-12 sm:items-center">
              <p className="truncate font-medium text-ink sm:col-span-4">{r.title}</p>
              <input value={r.code} onChange={(e) => set(r._id, { code: e.target.value })} placeholder="Código TUSS" className="h-9 rounded-lg border border-ink/15 px-2 text-sm outline-none focus:border-teal-500 sm:col-span-3" />
              <input value={r.description} onChange={(e) => set(r._id, { description: e.target.value })} placeholder="Descrição (opcional)" className="h-9 rounded-lg border border-ink/15 px-2 text-sm outline-none focus:border-teal-500 sm:col-span-5" />
            </div>
          ))}
        </div>
      )}
      {savedMsg && <p className="mt-4 text-sm font-medium text-teal-600">{savedMsg}</p>}
      {rows.length > 0 && (
        <button onClick={save} disabled={saving} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar códigos"}
        </button>
      )}
    </div>
  );
}

// ================= CONFIG TISS (Fase 2) =================
function TissConfigForm({ establishmentId }: { establishmentId: string }) {
  const [cfg, setCfg] = useState<TissConfig>({ tissVersion: "4.03.00" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    convenioApi
      .getTissConfig(establishmentId)
      .then((c) => setCfg({ tissVersion: "4.03.00", ...c }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [establishmentId]);

  const set = (patch: Partial<TissConfig>) => {
    setCfg((c) => ({ ...c, ...patch }));
    setSavedMsg(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await convenioApi.setTissConfig(establishmentId, cfg);
      setSavedMsg("Configuração salva.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando...
      </div>
    );
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";
  const field = (
    label: string,
    key: keyof TissConfig,
    placeholder = "",
    span = "sm:col-span-1"
  ) => (
    <label className={`block ${span}`}>
      <span className="mb-1 block text-xs font-medium text-ink/60">{label}</span>
      <input
        value={(cfg[key] as string) || ""}
        onChange={(e) => set({ [key]: e.target.value } as Partial<TissConfig>)}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
  );

  return (
    <div>
      <p className="text-sm text-ink/50">
        Dados do prestador usados para gerar o XML TISS (Guia de Consulta). O XML
        deve ser validado no validador oficial da ANS antes de enviar à operadora.
      </p>

      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
        <h4 className="font-display font-bold text-ink">Prestador</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {field("CNPJ", "cnpj", "somente números")}
          {field("CNES", "cnes")}
          {field("Código do prestador na operadora", "providerCode")}
          {field("Nome do contratado", "contractedName", "padrão: nome do estabelecimento")}
          {field("Versão do padrão TISS", "tissVersion", "4.03.00")}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
        <h4 className="font-display font-bold text-ink">
          Profissional executante (padrão)
        </h4>
        <p className="mt-0.5 text-xs text-ink/50">
          Usado nas guias. Para clínicas com vários profissionais, isso será
          ampliado depois.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {field("Nome do profissional", "profName")}
          {field("Conselho (código TISS, ex: 01=CRM)", "councilCode")}
          {field("Número do conselho", "councilNumber")}
          {field("UF do conselho", "councilUF", "SP")}
          {field("CBO-S", "cbo")}
        </div>
      </div>

      {savedMsg && (
        <p className="mt-4 text-sm font-medium text-teal-600">{savedMsg}</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar configuração"}
      </button>
    </div>
  );
}
