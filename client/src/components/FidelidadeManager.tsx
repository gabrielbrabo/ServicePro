import { useEffect, useMemo, useState } from "react";
import { Establishment } from "../api/establishment";
import {
  loyaltyApi,
  LoyaltyProgram,
  LoyaltyCard,
  LoyaltyEntry,
} from "../api/loyalty";

// ---------------------------------------------------------------------------
// Painel de FIDELIDADE do estabelecimento (comum a todas as areas).
// - Config do programa (meta + recompensa + ativo) — so o dono edita.
// - Recompensas PENDENTES: clientes que bateram a meta e ainda nao receberam.
//   O dono/funcionario marca "Entregue" (gera auditoria no back-end).
// - Cartoes: progresso de cada cliente, carimbo manual (+/-) e historico.
// O carimbo automatico acontece no back ao concluir um atendimento.
// ---------------------------------------------------------------------------

const clientName = (c: LoyaltyCard["client"]): string =>
  typeof c === "string" ? "Cliente" : c.name || "Cliente";
const clientId = (c: LoyaltyCard["client"]): string =>
  typeof c === "string" ? c : c._id;
const clientAvatar = (c: LoyaltyCard["client"]): string | undefined =>
  typeof c === "string" ? undefined : c.avatar;

const initials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "C";

const actionLabel: Record<LoyaltyEntry["action"], string> = {
  carimbo: "Carimbo",
  estorno: "Estorno",
  conquista: "Meta atingida",
  resgate: "Recompensa entregue",
};

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

export function FidelidadeManager({
  establishment,
}: {
  establishment: Establishment;
}) {
  const establishmentId = establishment._id;
  const isOwner = establishment.myRole !== "professional";

  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      loyaltyApi.getProgram(establishmentId),
      loyaltyApi.listCards(establishmentId),
    ])
      .then(([p, c]) => {
        setProgram(p);
        setCards(c);
      })
      .catch(() => flash("err", "Não foi possível carregar a fidelidade."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId]);

  const goal = Math.max(1, program?.goal || 10);
  const active = !!program?.active;

  const pending = useMemo(
    () => cards.filter((c) => (c.rewardsPending || 0) > 0),
    [cards]
  );

  if (loading) {
    return (
      <div className="py-16 text-center text-ink/50">Carregando fidelidade…</div>
    );
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            msg.kind === "ok"
              ? "bg-teal-50 text-teal-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </div>
      )}

      <ProgramCard
        program={program}
        isOwner={isOwner}
        establishmentId={establishmentId}
        onSaved={(p) => {
          setProgram(p);
          flash("ok", "Programa de fidelidade salvo.");
        }}
        onError={() => flash("err", "Erro ao salvar o programa.")}
      />

      {!active && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          O programa está <strong>desativado</strong>. Os atendimentos concluídos
          não geram carimbo enquanto ele estiver inativo.
        </div>
      )}

      {/* recompensas pendentes de entrega */}
      <PendingSection
        pending={pending}
        reward={program?.reward || ""}
        establishmentId={establishmentId}
        onDone={(msgText) => {
          flash("ok", msgText);
          load();
        }}
        onError={() => flash("err", "Erro ao registrar a entrega.")}
      />

      {/* cartoes dos clientes */}
      <CardsSection
        cards={cards}
        goal={goal}
        establishmentId={establishmentId}
        onChanged={load}
        onError={(t) => flash("err", t)}
      />
    </div>
  );
}

// ------------------------- Config do programa -------------------------

function ProgramCard({
  program,
  isOwner,
  establishmentId,
  onSaved,
  onError,
}: {
  program: LoyaltyProgram | null;
  isOwner: boolean;
  establishmentId: string;
  onSaved: (p: LoyaltyProgram) => void;
  onError: () => void;
}) {
  const [goal, setGoal] = useState<number>(program?.goal || 10);
  const [reward, setReward] = useState<string>(program?.reward || "");
  const [active, setActive] = useState<boolean>(!!program?.active);
  const [bonusOnReview, setBonusOnReview] = useState<boolean>(
    program?.bonusStampOnReview !== false
  );
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    loyaltyApi
      .setProgram(establishmentId, {
        goal: Math.max(1, Math.floor(goal) || 1),
        reward: reward.trim(),
        active,
        bonusStampOnReview: bonusOnReview,
      })
      .then((p) => {
        setGoal(p.goal);
        setReward(p.reward);
        setActive(p.active);
        setBonusOnReview(p.bonusStampOnReview !== false);
        onSaved(p);
      })
      .catch(onError)
      .finally(() => setSaving(false));
  };

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="text-lg font-semibold text-ink">Programa de fidelidade</h3>
        <p className="mt-2 text-sm text-ink/70">
          {program?.active ? (
            <>
              A cada <strong>{program.goal}</strong> atendimentos concluídos, o
              cliente ganha: <strong>{program.reward || "recompensa"}</strong>.
            </>
          ) : (
            "O programa está desativado no momento."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            Programa de fidelidade
          </h3>
          <p className="mt-1 text-sm text-ink/60">
            Ao concluir um atendimento, o cartão do cliente é carimbado
            automaticamente.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="text-sm font-medium text-ink/70">Ativo</span>
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${
              active ? "bg-teal-500" : "bg-ink/20"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                active ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
        <div>
          <label className="block text-sm font-medium text-ink/70">
            Meta (carimbos)
          </label>
          <input
            type="number"
            min={1}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink/70">
            Recompensa
          </label>
          <input
            type="text"
            value={reward}
            placeholder="Ex.: 1 corte grátis"
            onChange={(e) => setReward(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* incentivo: avaliar da +1 carimbo (aumenta as avaliacoes) */}
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-sand/40 p-3">
        <input
          type="checkbox"
          checked={bonusOnReview}
          onChange={(e) => setBonusOnReview(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-teal-500"
        />
        <span className="text-sm text-ink/70">
          <strong className="text-ink">Avaliar dá +1 carimbo.</strong> Quando o
          cliente avalia o atendimento, ganha um carimbo bônus — um incentivo a
          mais para deixar a avaliação.
        </span>
      </label>

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-teal-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar programa"}
        </button>
      </div>
    </div>
  );
}

// ------------------------- Recompensas pendentes -------------------------

function PendingSection({
  pending,
  reward,
  establishmentId,
  onDone,
  onError,
}: {
  pending: LoyaltyCard[];
  reward: string;
  establishmentId: string;
  onDone: (msg: string) => void;
  onError: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const deliver = (card: LoyaltyCard) => {
    const cid = clientId(card.client);
    const name = clientName(card.client);
    if (
      !window.confirm(
        `Confirmar que ${name} recebeu a recompensa "${
          reward || "recompensa"
        }"?`
      )
    )
      return;
    setBusy(cid);
    loyaltyApi
      .redeem(establishmentId, cid)
      .then(() => onDone(`Recompensa de ${name} registrada como entregue.`))
      .catch(onError)
      .finally(() => setBusy(null));
  };

  if (pending.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-800">
        <span>🎁</span> Recompensas a entregar ({pending.length})
      </h3>
      <p className="mt-1 text-sm text-amber-700">
        Estes clientes bateram a meta. Marque como entregue depois de dar a
        recompensa — fica registrado quem entregou.
      </p>
      <ul className="mt-4 space-y-2">
        {pending.map((card) => {
          const cid = clientId(card.client);
          const name = clientName(card.client);
          return (
            <li
              key={cid}
              className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar client={card.client} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{name}</p>
                  <p className="text-xs text-ink/60">
                    {card.rewardsPending > 1
                      ? `${card.rewardsPending} recompensas pendentes`
                      : "Recompensa pendente"}
                    {" · "}
                    {reward || "recompensa"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deliver(card)}
                disabled={busy === cid}
                className="shrink-0 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {busy === cid ? "…" : "Marcar entregue"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------- Lista de cartoes -------------------------

function CardsSection({
  cards,
  goal,
  establishmentId,
  onChanged,
  onError,
}: {
  cards: LoyaltyCard[];
  goal: number;
  establishmentId: string;
  onChanged: () => void;
  onError: (t: string) => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [openHist, setOpenHist] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((c) => clientName(c.client).toLowerCase().includes(term));
  }, [cards, q]);

  const stamp = (card: LoyaltyCard, add: boolean) => {
    const cid = clientId(card.client);
    setBusy(cid);
    const call = add
      ? loyaltyApi.addStamp(establishmentId, cid)
      : loyaltyApi.removeStamp(establishmentId, cid);
    call
      .then(() => onChanged())
      .catch((e) =>
        onError(
          e?.response?.data?.message ||
            (add ? "Erro ao carimbar." : "Erro ao estornar.")
        )
      )
      .finally(() => setBusy(null));
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">
          Cartões dos clientes ({cards.length})
        </h3>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente…"
          className="w-full max-w-xs rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink/50">
          {cards.length === 0
            ? "Nenhum cartão ainda. Conclua um atendimento para carimbar automaticamente."
            : "Nenhum cliente encontrado."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((card) => {
            const cid = clientId(card.client);
            const name = clientName(card.client);
            const filled = Math.min(card.stamps, goal);
            const complete = card.stamps >= goal;
            const isOpen = openHist === cid;
            return (
              <li
                key={cid}
                className="rounded-xl border border-ink/10 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar client={card.client} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">
                        {name}
                        {card.rewardsPending > 0 && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            🎁 recompensa pendente
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink/60">
                        {card.stamps}/{goal} carimbos
                        {card.rewardsGiven > 0 &&
                          ` · ${card.rewardsGiven} entregue${
                            card.rewardsGiven > 1 ? "s" : ""
                          }`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => stamp(card, false)}
                      disabled={busy === cid || card.stamps <= 0}
                      title="Estornar carimbo"
                      className="h-8 w-8 rounded-full bg-ink/5 text-lg font-bold text-ink/60 transition hover:bg-ink/10 disabled:opacity-40"
                    >
                      −
                    </button>
                    <button
                      onClick={() => stamp(card, true)}
                      disabled={busy === cid}
                      title="Adicionar carimbo"
                      className="h-8 w-8 rounded-full bg-teal-500 text-lg font-bold text-white transition hover:bg-teal-600 disabled:opacity-60"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setOpenHist(isOpen ? null : cid)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50"
                    >
                      {isOpen ? "Ocultar" : "Histórico"}
                    </button>
                  </div>
                </div>

                {/* barra de carimbos */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(goal, 20) }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-4 w-4 rounded-full border ${
                        i < filled
                          ? complete
                            ? "border-amber-400 bg-amber-400"
                            : "border-teal-500 bg-teal-500"
                          : "border-ink/20 bg-transparent"
                      }`}
                    />
                  ))}
                  {goal > 20 && (
                    <span className="ml-1 text-xs text-ink/50">
                      {card.stamps}/{goal}
                    </span>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 border-t border-ink/10 pt-3">
                    {card.history.length === 0 ? (
                      <p className="text-xs text-ink/50">Sem movimentações.</p>
                    ) : (
                      <ul className="space-y-1">
                        {[...card.history]
                          .reverse()
                          .slice(0, 30)
                          .map((h, i) => (
                            <li
                              key={h._id || i}
                              className="flex items-center justify-between text-xs"
                            >
                              <span
                                className={
                                  h.action === "resgate"
                                    ? "font-medium text-teal-600"
                                    : h.action === "conquista"
                                    ? "font-medium text-amber-600"
                                    : h.action === "estorno"
                                    ? "text-red-500"
                                    : "text-ink/70"
                                }
                              >
                                {actionLabel[h.action]}
                              </span>
                              <span className="text-ink/40">
                                {fmtDate(h.date)}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Avatar({ client }: { client: LoyaltyCard["client"] }) {
  const name = clientName(client);
  const avatar = clientAvatar(client);
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
      {initials(name)}
    </span>
  );
}
