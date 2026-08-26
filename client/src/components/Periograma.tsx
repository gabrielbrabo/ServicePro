import { useEffect, useMemo, useState } from "react";
import { periogramApi, PerioTooth } from "../api/periogram";

// quadrantes FDI (mesma disposicao do odontograma)
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

// 6 sitios por dente
const SITE_SHORT = ["MV", "V", "DV", "ML", "L", "DL"];
const SITE_FULL = [
  "Mésio-vestibular",
  "Vestibular",
  "Disto-vestibular",
  "Mésio-lingual",
  "Lingual",
  "Disto-lingual",
];

const zeros6 = () => [0, 0, 0, 0, 0, 0];
const zerosBool6 = () => [false, false, false, false, false, false];

interface Draft {
  pd: number[];
  rec: number[];
  bop: boolean[];
  mobility: number;
  furcation: number;
  note: string;
}

const emptyDraft = (): Draft => ({
  pd: zeros6(),
  rec: zeros6(),
  bop: zerosBool6(),
  mobility: 0,
  furcation: 0,
  note: "",
});

const toDraft = (t?: PerioTooth): Draft =>
  t
    ? {
        pd: [...t.pd],
        rec: [...t.rec],
        bop: [...t.bop],
        mobility: t.mobility,
        furcation: t.furcation,
        note: t.note || "",
      }
    : emptyDraft();

const maxPd = (t: PerioTooth): number => Math.max(0, ...t.pd);
const hasBop = (t: PerioTooth): boolean => t.bop.some((b) => b);

// cor de fundo do dente no mapa conforme a maior PD
function pdColor(pd: number): string {
  if (pd >= 6) return "#f87171"; // vermelho
  if (pd >= 4) return "#fbbf24"; // ambar
  if (pd >= 1) return "#34d399"; // verde
  return "#ffffff";
}

export function Periograma({
  establishmentId,
  clientId,
}: {
  establishmentId: string;
  clientId: string;
}) {
  const [teeth, setTeeth] = useState<PerioTooth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    periogramApi
      .get(establishmentId, clientId)
      .then((p) => setTeeth(p.teeth || []))
      .catch(() => setError("Não foi possível carregar o periograma."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const byNumber = useMemo(() => {
    const m = new Map<number, PerioTooth>();
    teeth.forEach((t) => m.set(t.number, t));
    return m;
  }, [teeth]);

  // resumo
  const summary = useMemo(() => {
    const charted = teeth.length;
    let deep = 0;
    let bop = 0;
    teeth.forEach((t) => {
      t.pd.forEach((n) => {
        if (n >= 4) deep++;
      });
      t.bop.forEach((b) => {
        if (b) bop++;
      });
    });
    const sites = charted * 6;
    const bopPct = sites ? Math.round((bop / sites) * 100) : 0;
    return { charted, deep, bopPct };
  }, [teeth]);

  const openTooth = (n: number) => {
    setSelected(n);
    setDraft(toDraft(byNumber.get(n)));
    setError(null);
  };

  const setSite = (kind: "pd" | "rec", i: number, val: string) =>
    setDraft((d) => {
      const arr = [...d[kind]];
      const n = parseInt(val, 10);
      arr[i] = isNaN(n) ? 0 : Math.min(20, Math.max(0, n));
      return { ...d, [kind]: arr };
    });

  const toggleBop = (i: number) =>
    setDraft((d) => {
      const arr = [...d.bop];
      arr[i] = !arr[i];
      return { ...d, bop: arr };
    });

  const save = async () => {
    if (selected == null) return;
    setSaving(true);
    setError(null);
    try {
      const p = await periogramApi.setTooth(establishmentId, clientId, {
        number: selected,
        pd: draft.pd,
        rec: draft.rec,
        bop: draft.bop,
        mobility: draft.mobility,
        furcation: draft.furcation,
        note: draft.note.trim() || undefined,
      });
      setTeeth(p.teeth || []);
    } catch {
      setError("Não foi possível salvar o dente.");
    } finally {
      setSaving(false);
    }
  };

  const clearTooth = async () => {
    if (selected == null) return;
    setDraft(emptyDraft());
    setSaving(true);
    try {
      const p = await periogramApi.setTooth(establishmentId, clientId, {
        number: selected,
        pd: zeros6(),
        rec: zeros6(),
        bop: zerosBool6(),
        mobility: 0,
        furcation: 0,
      });
      setTeeth(p.teeth || []);
    } catch {
      setError("Não foi possível limpar o dente.");
    } finally {
      setSaving(false);
    }
  };

  const Tooth = ({ n }: { n: number }) => {
    const t = byNumber.get(n);
    const isSel = selected === n;
    const color = t ? pdColor(maxPd(t)) : "#ffffff";
    const white = /^#?f{6}$/i.test(color);
    return (
      <button
        type="button"
        onClick={() => openTooth(n)}
        title={t ? `${n} · PD máx ${maxPd(t)}mm` : `${n}`}
        className={`relative flex h-9 w-7 shrink-0 flex-col items-center justify-center rounded-md border transition ${
          isSel
            ? "border-teal-500 ring-2 ring-teal-500"
            : t
            ? "border-ink/20"
            : "border-ink/10"
        }`}
        style={{
          backgroundColor: white ? "#fff" : color,
        }}
      >
        <span className="text-[10px] font-bold text-ink/70">{n}</span>
        {t && hasBop(t) && (
          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        )}
      </button>
    );
  };

  const Row = ({ left, right }: { left: number[]; right: number[] }) => (
    <div className="flex items-center justify-center gap-2">
      <div className="flex gap-1">
        {left.map((n) => (
          <Tooth key={n} n={n} />
        ))}
      </div>
      <div className="h-9 w-px bg-ink/15" />
      <div className="flex gap-1">
        {right.map((n) => (
          <Tooth key={n} n={n} />
        ))}
      </div>
    </div>
  );

  // grupo de 3 sitios (vestibular = 0..2, lingual = 3..5)
  const SiteGroup = ({ title, base }: { title: string; base: 0 | 3 }) => (
    <div className="rounded-xl border border-ink/10 bg-sand/30 p-3">
      <p className="mb-2 text-xs font-semibold text-ink/60">{title}</p>
      <div className="grid grid-cols-[auto_repeat(3,1fr)] items-center gap-x-2 gap-y-1.5">
        <span className="text-[10px] text-ink/40" />
        {[0, 1, 2].map((k) => (
          <span
            key={k}
            className="text-center text-[10px] font-semibold text-ink/50"
            title={SITE_FULL[base + k]}
          >
            {SITE_SHORT[base + k]}
          </span>
        ))}

        <span className="text-[11px] font-medium text-ink/60">PS</span>
        {[0, 1, 2].map((k) => (
          <input
            key={k}
            inputMode="numeric"
            value={draft.pd[base + k] === 0 ? "" : draft.pd[base + k]}
            onChange={(e) => setSite("pd", base + k, e.target.value)}
            placeholder="0"
            className="h-8 w-full rounded border border-ink/15 text-center text-sm outline-none focus:border-teal-500"
          />
        ))}

        <span className="text-[11px] font-medium text-ink/60">REC</span>
        {[0, 1, 2].map((k) => (
          <input
            key={k}
            inputMode="numeric"
            value={draft.rec[base + k] === 0 ? "" : draft.rec[base + k]}
            onChange={(e) => setSite("rec", base + k, e.target.value)}
            placeholder="0"
            className="h-8 w-full rounded border border-ink/15 text-center text-sm outline-none focus:border-teal-500"
          />
        ))}

        <span className="text-[11px] font-medium text-ink/40">NIC</span>
        {[0, 1, 2].map((k) => (
          <span
            key={k}
            className="text-center text-xs text-ink/50"
            title="Nível de inserção clínica (PS + REC)"
          >
            {draft.pd[base + k] + draft.rec[base + k]}
          </span>
        ))}

        <span className="text-[11px] font-medium text-ink/60">Sang.</span>
        {[0, 1, 2].map((k) => (
          <div key={k} className="flex justify-center">
            <input
              type="checkbox"
              checked={draft.bop[base + k]}
              onChange={() => toggleBop(base + k)}
              className="h-4 w-4 accent-red-500"
            />
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando periograma...
      </div>
    );
  }

  return (
    <div>
      {/* resumo */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-sand px-3 py-1 text-ink/70">
          {summary.charted} dente{summary.charted !== 1 ? "s" : ""} examinado
          {summary.charted !== 1 ? "s" : ""}
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
          {summary.deep} sítio(s) com PS ≥ 4mm
        </span>
        <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
          Sangramento {summary.bopPct}%
        </span>
      </div>

      {/* mapa dental */}
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white p-4">
        <div className="mx-auto w-max space-y-3">
          <Row left={UPPER_RIGHT} right={UPPER_LEFT} />
          <div className="h-px bg-ink/10" />
          <Row left={LOWER_RIGHT} right={LOWER_LEFT} />
        </div>
      </div>

      {/* legenda */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-ink/15 bg-white" /> sem
          dado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: "#34d399" }}
          />{" "}
          PS ≤ 3mm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: "#fbbf24" }}
          />{" "}
          4–5mm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: "#f87171" }}
          />{" "}
          ≥ 6mm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> sangramento
        </span>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

      {/* editor do dente */}
      {selected != null && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-bold text-ink">
              Dente {selected}
            </h4>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-ink/50 hover:text-ink"
            >
              Fechar
            </button>
          </div>
          <p className="mt-0.5 text-xs text-ink/50">
            PS = profundidade de sondagem · REC = recessão · NIC = nível de
            inserção (PS+REC). Medidas em mm.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SiteGroup title="Vestibular" base={0} />
            <SiteGroup title="Lingual / Palatina" base={3} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Mobilidade (0–3)
              </span>
              <select
                value={draft.mobility}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, mobility: Number(e.target.value) }))
                }
                className="h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
              >
                {[0, 1, 2, 3].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Furca (0–3)
              </span>
              <select
                value={draft.furcation}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, furcation: Number(e.target.value) }))
                }
                className="h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
              >
                {[0, 1, 2, 3].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                Observação
              </span>
              <input
                value={draft.note}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, note: e.target.value }))
                }
                className="h-9 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="h-10 rounded-xl bg-teal-500 px-6 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar dente"}
            </button>
            <button
              onClick={clearTooth}
              disabled={saving}
              className="h-10 rounded-xl border border-ink/15 px-4 text-sm font-medium text-ink/70 transition hover:bg-sand disabled:opacity-50"
            >
              Limpar dente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
