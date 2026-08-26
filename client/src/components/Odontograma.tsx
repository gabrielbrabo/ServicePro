import { useEffect, useMemo, useState, CSSProperties } from "react";
import { odontogramApi, ToothMark, ToothStatusDef } from "../api/odontogram";
import { treatmentPlanApi } from "../api/treatmentPlan";
import {
  DEFAULT_TOOTH_STATUSES,
  NEUTRAL_STATUS,
  slugifyKey,
  hexToRgba,
  isWhite,
} from "../config/odontogramStatuses";

// quadrantes FDI
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const FACE_KEYS = ["V", "O", "M", "D", "L"] as const;
type FaceKey = (typeof FACE_KEYS)[number];

// nome da face conforme a posicao do dente (anterior x posterior, arcada)
function faceLabel(face: string, tooth: number): string {
  const pos = tooth % 10;
  const anterior = pos >= 1 && pos <= 3;
  const q = Math.floor(tooth / 10);
  const upper = q === 1 || q === 2;
  switch (face) {
    case "V":
      return "Vestibular";
    case "O":
      return anterior ? "Incisal" : "Oclusal";
    case "M":
      return "Mesial";
    case "D":
      return "Distal";
    case "L":
      return upper ? "Palatina" : "Lingual";
    default:
      return face;
  }
}

// posicao "linha-coluna" (1..3) de cada face no glifo 3x3.
// mesial (M) fica voltado para a linha media: à direita nos quadrantes 1 e 4.
function facePositions(tooth: number): Record<FaceKey, string> {
  const q = Math.floor(tooth / 10);
  const rightSide = q === 1 || q === 4;
  return {
    V: "1-2",
    O: "2-2",
    L: "3-2",
    M: rightSide ? "2-3" : "2-1",
    D: rightSide ? "2-1" : "2-3",
  };
}

const faceStatusOf = (mark: ToothMark | undefined, face: string) =>
  mark?.faces?.find((f) => f.face === face)?.status;

export function Odontograma({
  establishmentId,
  clientId,
  canPlano = false,
}: {
  establishmentId: string;
  clientId: string;
  canPlano?: boolean;
}) {
  const [teeth, setTeeth] = useState<ToothMark[]>([]);
  const [statuses, setStatuses] = useState<ToothStatusDef[]>(
    DEFAULT_TOOTH_STATUSES
  );
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [target, setTarget] = useState<"tooth" | FaceKey>("tooth");
  const [saving, setSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [managing, setManaging] = useState(false);
  const [addingPlan, setAddingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      odontogramApi.get(establishmentId, clientId),
      odontogramApi.getStatuses(establishmentId).catch(() => ({
        statuses: DEFAULT_TOOTH_STATUSES,
        isDefault: true,
      })),
    ])
      .then(([o, s]) => {
        setTeeth(o.teeth || []);
        setStatuses(s.statuses?.length ? s.statuses : DEFAULT_TOOTH_STATUSES);
        setIsDefault(!!s.isDefault);
      })
      .catch(() => setError("Não foi possível carregar o odontograma."))
      .finally(() => setLoading(false));
  }, [establishmentId, clientId]);

  const byNumber = useMemo(() => {
    const m = new Map<number, ToothMark>();
    teeth.forEach((t) => m.set(t.number, t));
    return m;
  }, [teeth]);

  const statusMap = useMemo(() => {
    const m = new Map<string, ToothStatusDef>();
    statuses.forEach((s) => m.set(s.key, s));
    return m;
  }, [statuses]);

  const colorOf = (key?: string): string => {
    if (!key || key === NEUTRAL_STATUS) return "#ffffff";
    return statusMap.get(key)?.color || "#ffffff";
  };
  const labelOf = (key?: string): string =>
    key ? statusMap.get(key)?.label || key : "";

  const openTooth = (n: number) => {
    setSelected(n);
    setTarget("tooth");
    setNoteDraft(byNumber.get(n)?.note || "");
    setError(null);
    setPlanMsg(null);
  };

  const applyStatus = async (key: string) => {
    if (selected == null) return;
    const face = target === "tooth" ? undefined : target;
    setSaving(true);
    setError(null);
    try {
      const o = await odontogramApi.setTooth(establishmentId, clientId, {
        number: selected,
        status: key,
        face,
        note: noteDraft.trim() || undefined,
      });
      setTeeth(o.teeth || []);
    } catch {
      setError("Não foi possível salvar o dente.");
    } finally {
      setSaving(false);
    }
  };

  // envia o procedimento atual do dente para o plano de tratamento.
  // usa um plano "aberto" existente ou cria um novo.
  const addToPlan = async () => {
    if (selected == null) return;
    const mark = byNumber.get(selected);
    const key =
      target === "tooth" ? mark?.status : faceStatusOf(mark, target);
    if (!key || key === NEUTRAL_STATUS) {
      setPlanMsg("Escolha um status para este dente antes de enviar ao plano.");
      return;
    }
    const faceTxt = target === "tooth" ? "" : ` (${faceLabel(target, selected)})`;
    const desc = `Dente ${selected}${faceTxt} — ${labelOf(key)}`;
    setAddingPlan(true);
    setPlanMsg(null);
    try {
      const plans = await treatmentPlanApi.list(establishmentId, clientId);
      let plan = plans.find((p) => p.status === "aberto");
      if (!plan) {
        plan = await treatmentPlanApi.create(establishmentId, clientId, {});
      }
      await treatmentPlanApi.addItem(establishmentId, plan._id, {
        description: desc,
        price: 0,
      });
      setPlanMsg(`Adicionado ao plano de tratamento: ${desc}`);
    } catch {
      setPlanMsg("Não foi possível adicionar ao plano.");
    } finally {
      setAddingPlan(false);
    }
  };

  // ---- glifo do dente (mapa) ----
  const cellStyle = (color: string): CSSProperties =>
    isWhite(color)
      ? { backgroundColor: "#fff", borderColor: "rgba(15,23,42,0.12)" }
      : { backgroundColor: color, borderColor: hexToRgba(color, 0.55) };

  const Tooth = ({ n }: { n: number }) => {
    const mark = byNumber.get(n);
    const whole = mark?.status;
    const isSel = selected === n;
    const pos = facePositions(n);
    const faceAt: Record<string, FaceKey> = {};
    FACE_KEYS.forEach((f) => (faceAt[pos[f]] = f));

    const cells = [];
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) {
        const face = faceAt[`${r}-${c}`];
        const key = face ? faceStatusOf(mark, face) || whole : whole;
        cells.push(
          <span
            key={`${r}-${c}`}
            style={cellStyle(colorOf(key))}
            className="h-2.5 w-2.5 rounded-[1px] border"
          />
        );
      }
    }
    const marked = !!whole || !!(mark?.faces && mark.faces.length);

    return (
      <button
        type="button"
        onClick={() => openTooth(n)}
        title={`${n}${whole ? ` · ${labelOf(whole)}` : ""}`}
        className={`flex shrink-0 flex-col items-center rounded-md border p-1 transition ${
          isSel
            ? "border-teal-500 ring-2 ring-teal-500"
            : marked
            ? "border-ink/20"
            : "border-ink/10"
        }`}
      >
        <span className="grid grid-cols-3 gap-px">{cells}</span>
        <span className="mt-0.5 text-[10px] font-bold text-ink/70">{n}</span>
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
      <div className="h-12 w-px bg-ink/15" />
      <div className="flex gap-1">
        {right.map((n) => (
          <Tooth key={n} n={n} />
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando odontograma...
      </div>
    );
  }

  const selMark = selected != null ? byNumber.get(selected) : undefined;
  // status atualmente aplicado ao alvo (dente inteiro ou face) — para destacar o chip
  const currentKey =
    selected == null
      ? undefined
      : target === "tooth"
      ? selMark?.status
      : faceStatusOf(selMark, target);

  return (
    <div>
      {/* barra de acoes */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink/50">
          {isDefault
            ? "Status: padrão do sistema"
            : "Status: personalizados desta clínica"}
        </p>
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:border-teal-500 hover:text-teal-600"
        >
          ⚙ Gerenciar status
        </button>
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
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {statuses
          .filter((s) => s.key !== NEUTRAL_STATUS)
          .map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 text-xs text-ink/60"
            >
              <span
                className="h-3 w-3 rounded-sm border"
                style={{
                  backgroundColor: s.color,
                  borderColor: hexToRgba(s.color, 0.5),
                }}
              />
              {s.label}
            </span>
          ))}
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

      {/* editor do dente selecionado */}
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

          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* glifo grande com faces clicaveis */}
            <div className="shrink-0">
              <BigGlyph
                tooth={selected}
                mark={selMark}
                target={target}
                onPick={setTarget}
                colorOf={colorOf}
              />
              <button
                type="button"
                onClick={() => setTarget("tooth")}
                className={`mt-2 w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  target === "tooth"
                    ? "border-teal-500 bg-teal-500 text-white"
                    : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                }`}
              >
                Dente inteiro
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-xs font-medium text-ink/60">
                Aplicando em:{" "}
                <b className="text-ink/80">
                  {target === "tooth"
                    ? "Dente inteiro"
                    : faceLabel(target, selected)}
                </b>
              </p>
              <div className="flex flex-wrap gap-2">
                {statuses.map((s) => {
                  const active = (currentKey || NEUTRAL_STATUS) === s.key;
                  const white = s.key === NEUTRAL_STATUS || isWhite(s.color);
                  const activeStyle: CSSProperties = white
                    ? {
                        backgroundColor: "#fff",
                        color: "rgba(15,23,42,0.75)",
                        borderColor: "rgba(15,23,42,0.2)",
                      }
                    : {
                        backgroundColor: s.color,
                        color: "#fff",
                        borderColor: s.color,
                      };
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={saving}
                      onClick={() => applyStatus(s.key)}
                      style={active ? activeStyle : undefined}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                        active
                          ? ""
                          : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-medium text-ink/60">
                  Observação do dente (salva junto ao escolher um status)
                </span>
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Ex: acompanhar, sensibilidade..."
                  className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>

              {selMark?.faces && selMark.faces.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/50">
                  {selMark.faces.map((f) => (
                    <span key={f.face}>
                      {faceLabel(f.face, selected)}:{" "}
                      <b className="text-ink/70">{labelOf(f.status)}</b>
                    </span>
                  ))}
                </div>
              )}

              {canPlano && (
                <div className="mt-4 border-t border-ink/10 pt-3">
                  <button
                    type="button"
                    onClick={addToPlan}
                    disabled={addingPlan}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-500/20 disabled:opacity-50"
                  >
                    {addingPlan
                      ? "Adicionando..."
                      : "+ Adicionar ao plano de tratamento"}
                  </button>
                  {planMsg && (
                    <p className="mt-2 text-xs text-ink/60">{planMsg}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {managing && (
        <StatusManager
          establishmentId={establishmentId}
          statuses={statuses}
          onClose={() => setManaging(false)}
          onSaved={(res) => {
            setStatuses(res.statuses);
            setIsDefault(res.isDefault);
            setManaging(false);
          }}
        />
      )}
    </div>
  );
}

// ---- glifo grande com faces clicaveis (editor) ----
function BigGlyph({
  tooth,
  mark,
  target,
  onPick,
  colorOf,
}: {
  tooth: number;
  mark: ToothMark | undefined;
  target: "tooth" | FaceKey;
  onPick: (t: FaceKey) => void;
  colorOf: (key?: string) => string;
}) {
  const whole = mark?.status;
  const pos = facePositions(tooth);
  const faceAt: Record<string, FaceKey> = {};
  FACE_KEYS.forEach((f) => (faceAt[pos[f]] = f));

  const cells = [];
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      const face = faceAt[`${r}-${c}`];
      const key = face ? faceStatusOf(mark, face) || whole : whole;
      const color = colorOf(key);
      const white = isWhite(color);
      const isTarget = face && target === face;
      cells.push(
        <button
          key={`${r}-${c}`}
          type="button"
          disabled={!face}
          onClick={() => face && onPick(face)}
          title={face ? faceLabel(face, tooth) : ""}
          style={{
            backgroundColor: white ? "#fff" : color,
            borderColor: white ? "rgba(15,23,42,0.15)" : hexToRgba(color, 0.6),
          }}
          className={`h-8 w-8 rounded-[3px] border text-[9px] font-bold text-ink/40 transition ${
            face ? "cursor-pointer" : "cursor-default"
          } ${isTarget ? "ring-2 ring-teal-500 ring-offset-1" : ""}`}
        >
          {face || ""}
        </button>
      );
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-ink/10 bg-sand/40 p-2">
        {cells}
      </div>
      <p className="mt-1 text-center text-[10px] text-ink/40">
        Clique numa face
      </p>
    </div>
  );
}

// ---- Painel de personalizacao dos status (modal) ----
function StatusManager({
  establishmentId,
  statuses,
  onClose,
  onSaved,
}: {
  establishmentId: string;
  statuses: ToothStatusDef[];
  onClose: () => void;
  onSaved: (res: { statuses: ToothStatusDef[]; isDefault: boolean }) => void;
}) {
  const [draft, setDraft] = useState<ToothStatusDef[]>(() =>
    statuses.map((s) => ({ ...s }))
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const update = (i: number, patch: Partial<ToothStatusDef>) =>
    setDraft((d) => d.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const remove = (i: number) =>
    setDraft((d) => d.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (i < 1 || j < 1 || j >= draft.length) return; // neutro fica no topo
    setDraft((d) => {
      const copy = [...d];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const add = () => {
    setDraft((d) => {
      const taken = new Set(d.map((s) => s.key));
      const key = slugifyKey("Novo status", taken);
      return [...d, { key, label: "Novo status", color: "#94a3b8" }];
    });
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const cleaned = draft
        .map((s) => ({ ...s, label: s.label.trim() }))
        .filter((s) => s.label.length > 0);
      if (cleaned.length < 2) {
        setErr("Inclua ao menos um status além do Hígido.");
        setSaving(false);
        return;
      }
      const res = await odontogramApi.setStatuses(establishmentId, cleaned);
      onSaved(res);
    } catch {
      setErr("Não foi possível salvar. Tente novamente.");
      setSaving(false);
    }
  };

  const resetDefault = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await odontogramApi.setStatuses(establishmentId, null);
      onSaved(res);
    } catch {
      setErr("Não foi possível restaurar o padrão.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">
            Status do odontograma
          </h3>
          <button
            onClick={onClose}
            className="text-sm text-ink/50 hover:text-ink"
          >
            Fechar
          </button>
        </div>
        <p className="mt-1 text-sm text-ink/50">
          Personalize os status e cores usados nesta clínica. “Hígido” é o
          estado normal e não pode ser removido.
        </p>

        <div className="mt-4 space-y-2">
          {draft.map((s, i) => {
            const locked = s.key === NEUTRAL_STATUS;
            return (
              <div
                key={s.key}
                className="flex items-center gap-2 rounded-xl border border-ink/10 bg-sand/30 p-2"
              >
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : "#94a3b8"}
                  onChange={(e) => update(i, { color: e.target.value })}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded border border-ink/15 bg-white"
                  title="Cor"
                />
                <input
                  value={s.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Nome do status"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i < 2}
                    className="flex h-7 w-7 items-center justify-center rounded border border-ink/15 text-ink/60 disabled:opacity-30"
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={locked || i === draft.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded border border-ink/15 text-ink/60 disabled:opacity-30"
                    title="Descer"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={locked}
                    className="flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-500 disabled:opacity-30"
                    title={locked ? "Não pode remover o Hígido" : "Remover"}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={add}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink/25 px-3 py-2 text-sm font-medium text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
        >
          + Adicionar status
        </button>

        {err && <p className="mt-3 text-sm font-medium text-red-500">{err}</p>}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetDefault}
            disabled={saving}
            className="text-sm font-medium text-ink/50 hover:text-ink disabled:opacity-50"
          >
            Restaurar padrão
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-teal-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}