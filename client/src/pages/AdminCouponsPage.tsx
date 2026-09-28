import { useCallback, useEffect, useState, FormEvent } from "react";
import { PageContainer } from "../components/NavBar";
import { useAuth } from "../context/AuthContext";
import {
  couponApi,
  AdminCoupon,
  CouponType,
  CouponCycle,
  NewCouponPayload,
} from "../api/coupon";

// Ferramenta interna: gerar e gerenciar cupons da assinatura. So abre para os
// e-mails em ADMIN_EMAILS (o servidor tambem bloqueia as rotas).
export function AdminCouponsPage() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<AdminCoupon[]>([]);
  const [copied, setCopied] = useState("");
  const [usesOf, setUsesOf] = useState<{
    code: string;
    list: { at: string; ownerName: string; ownerEmail: string; establishmentName: string }[];
  } | null>(null);

  // formulario
  const [type, setType] = useState<CouponType>("free");
  const [freeMonths, setFreeMonths] = useState(1);
  const [percent, setPercent] = useState(20);
  const [duration, setDuration] = useState<"once" | "n" | "forever">("once");
  const [charges, setCharges] = useState(3);
  const [appliesTo, setAppliesTo] = useState<CouponCycle>("ambos");
  const [maxUses, setMaxUses] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    couponApi
      .adminList()
      .then(setCoupons)
      .catch(() => setError("Não foi possível carregar os cupons."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user?.isAdmin) load();
  }, [user?.isAdmin, load]);

  if (!user?.isAdmin) {
    return (
      <PageContainer>
        <p className="text-ink/60">Página não encontrada.</p>
      </PageContainer>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: NewCouponPayload = {
        type,
        appliesTo,
        maxUses,
        note: note.trim() || undefined,
        expiresAt: expiresAt || undefined,
        code: code.trim() || undefined,
        quantity: code.trim() ? 1 : quantity,
      };
      if (type === "free") payload.freeMonths = freeMonths;
      else {
        payload.percent = percent;
        payload.discountCharges =
          duration === "once" ? 1 : duration === "forever" ? -1 : charges;
      }
      const list = await couponApi.adminCreate(payload);
      setCreated(list);
      setCode("");
      load();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(msg || "Não foi possível gerar o cupom.");
    } finally {
      setSaving(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(text);
        setTimeout(() => setCopied(""), 1500);
      })
      .catch(() => {});
  };

  const toggle = async (c: AdminCoupon) => {
    try {
      const u = await couponApi.adminSetActive(c._id, !c.active);
      setCoupons((l) => l.map((x) => (x._id === c._id ? u : x)));
    } catch {
      setError("Não foi possível atualizar o cupom.");
    }
  };

  const showUses = async (c: AdminCoupon) => {
    try {
      const list = await couponApi.adminRedemptions(c._id);
      setUsesOf({ code: c.code, list });
    } catch {
      setError("Não foi possível carregar os usos.");
    }
  };

  const input =
    "h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500";
  const label = "mb-1 block text-sm font-medium text-ink/70";

  return (
    <PageContainer>
      <h1 className="font-display text-2xl font-bold text-ink">Cupons</h1>
      <p className="mt-1 text-sm text-ink/60">
        Gere cupons de mensalidade grátis ou de desconto para os
        estabelecimentos. Só você vê esta página.
      </p>

      {/* gerar */}
      <form
        onSubmit={submit}
        className="mt-6 space-y-4 rounded-2xl border border-ink/10 bg-white p-5"
      >
        <div>
          <span className={label}>Tipo de cupom</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["free", "🎁 Mensalidade grátis", "Usa o sistema sem pagar por X meses"],
                ["discount", "🏷️ Desconto", "% a menos na mensalidade ou anuidade"],
              ] as const
            ).map(([k, t, d]) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className={`rounded-xl border p-3 text-left transition ${
                  type === k
                    ? "border-teal-500 ring-2 ring-teal-500/20"
                    : "border-ink/15 hover:border-teal-500"
                }`}
              >
                <p className="font-semibold text-ink">{t}</p>
                <p className="text-xs text-ink/50">{d}</p>
              </button>
            ))}
          </div>
        </div>

        {type === "free" ? (
          <label className="block max-w-xs">
            <span className={label}>Meses grátis</span>
            <input
              type="number"
              min={1}
              max={24}
              value={freeMonths}
              onChange={(e) => setFreeMonths(Number(e.target.value))}
              className={input}
            />
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={label}>Desconto (%)</span>
              <input
                type="number"
                min={1}
                max={90}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className={input}
              />
            </label>
            <label className="block">
              <span className={label}>Vale por</span>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as typeof duration)}
                className={input}
              >
                <option value="once">Só a 1ª cobrança</option>
                <option value="n">Algumas cobranças</option>
                <option value="forever">Para sempre</option>
              </select>
              {duration === "n" && (
                <span className="mt-1 block text-xs text-ink/50">
                  No plano anual vale só para 1 anuidade.
                </span>
              )}
            </label>
            {duration === "n" && (
              <label className="block">
                <span className={label}>Nº de cobranças</span>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={charges}
                  onChange={(e) => setCharges(Number(e.target.value))}
                  className={input}
                />
              </label>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={label}>Vale para o plano</span>
            <select
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value as CouponCycle)}
              className={input}
            >
              <option value="ambos">Mensal e anual</option>
              <option value="mensal">Só mensal</option>
              <option value="anual">Só anual</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Limite de usos (0 = sem limite)</span>
            <input
              type="number"
              min={0}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Válido até (opcional)</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={input}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={label}>Código próprio (opcional)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ex.: LANCAMENTO"
              className={`${input} uppercase`}
            />
          </label>
          <label className="block">
            <span className={label}>Quantidade de códigos</span>
            <input
              type="number"
              min={1}
              max={100}
              value={code.trim() ? 1 : quantity}
              disabled={!!code.trim()}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className={`${input} disabled:opacity-50`}
            />
          </label>
          <label className="block">
            <span className={label}>Observação (só para você)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex.: visita barbearias"
              className={input}
            />
          </label>
        </div>
        <p className="text-xs text-ink/50">
          Sem código próprio, o sistema gera códigos aleatórios. Vários códigos
          com limite 1 = um código diferente para cada estabelecimento.
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
        >
          {saving ? "Gerando..." : "Gerar cupom"}
        </button>

        {created.length > 0 && (
          <div className="rounded-xl bg-teal-500/5 p-4">
            <p className="text-sm font-semibold text-teal-800">
              {created.length === 1 ? "Cupom gerado:" : `${created.length} cupons gerados:`}{" "}
              <span className="font-normal text-ink/60">{created[0].label}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {created.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => copy(c.code)}
                  className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-semibold text-ink ring-1 ring-ink/10 hover:ring-teal-500"
                >
                  {copied === c.code ? "Copiado!" : c.code}
                </button>
              ))}
            </div>
            {created.length > 1 && (
              <button
                type="button"
                onClick={() => copy(created.map((c) => c.code).join("\n"))}
                className="mt-2 text-xs font-semibold text-teal-700 hover:underline"
              >
                Copiar todos
              </button>
            )}
          </div>
        )}
      </form>

      {/* lista */}
      <h2 className="mt-8 font-display text-lg font-bold text-ink">Cupons criados</h2>
      {loading ? (
        <p className="mt-3 text-ink/50">Carregando...</p>
      ) : coupons.length === 0 ? (
        <p className="mt-3 text-ink/50">Nenhum cupom ainda.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {coupons.map((c) => {
            const expired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
            const full = c.maxUses > 0 && c.usedCount >= c.maxUses;
            return (
              <div
                key={c._id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 ${
                  !c.active || expired || full ? "opacity-60" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => copy(c.code)}
                  title="Copiar código"
                  className="font-mono text-sm font-bold text-ink hover:text-teal-600"
                >
                  {copied === c.code ? "Copiado!" : c.code}
                </button>
                <span className="text-sm text-ink/70">{c.label}</span>
                <span className="text-xs text-ink/50">
                  {c.usedCount}/{c.maxUses || "∞"} usos
                  {c.expiresAt &&
                    ` · até ${new Date(c.expiresAt).toLocaleDateString("pt-BR")}`}
                  {c.note && ` · ${c.note}`}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {c.usedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => showUses(c)}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      Ver usos
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      c.active
                        ? "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                        : "bg-teal-500/10 text-teal-700 hover:bg-teal-500/20"
                    }`}
                  >
                    {c.active ? "Desativar" : "Ativar"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {usesOf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
          onClick={() => setUsesOf(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold text-ink">Usos de {usesOf.code}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {usesOf.list.map((u, i) => (
                <li key={i} className="rounded-lg bg-sand/60 px-3 py-2">
                  <b>{u.establishmentName || "—"}</b>
                  <span className="block text-xs text-ink/60">
                    {u.ownerName} · {u.ownerEmail} ·{" "}
                    {new Date(u.at).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setUsesOf(null)}
              className="mt-4 h-10 w-full rounded-xl border border-ink/15 font-medium text-ink/70 hover:bg-sand"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
