import { useEffect, useState } from "react";
import { couponApi, CouponCheck } from "../api/coupon";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Campo "Tem um cupom?": confere o codigo no servidor e devolve o cupom valido
// para o formulario decidir (meses gratis = sem pagamento; desconto = preco
// menor). Se o ciclo mudar, confere de novo (o cupom pode valer so p/ um).
export function CouponField({
  planId,
  billingCycle,
  value,
  onChange,
}: {
  planId: string;
  billingCycle: "mensal" | "anual";
  value: CouponCheck | null;
  onChange: (c: CouponCheck | null) => void;
}) {
  const [open, setOpen] = useState(!!value);
  const [code, setCode] = useState(value?.code || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const apply = async (c = code) => {
    const clean = c.trim();
    if (!clean) return;
    setLoading(true);
    setError("");
    try {
      onChange(await couponApi.check(clean, planId, billingCycle));
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(msg || "Cupom inválido.");
      onChange(null);
    } finally {
      setLoading(false);
    }
  };

  // ciclo/plano mudou com cupom aplicado: reconfere
  useEffect(() => {
    if (value) void apply(value.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingCycle, planId]);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-teal-500/30 bg-teal-500/5 px-4 py-3">
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-teal-800 dark:text-teal-300">
            🎟️ Cupom {value.code} aplicado
          </p>
          <p className="text-ink/70">{value.label}</p>
          {value.type === "discount" && value.fullCents > 0 && (
            <p className="mt-0.5 text-ink/70">
              <span className="text-ink/40 line-through">{brl(value.fullCents)}</span>{" "}
              <b className="text-teal-700">{brl(value.discountedCents)}</b>
              {value.discountCharges === 1
                ? " na 1ª cobrança"
                : value.discountCharges === -1
                  ? " em todas as cobranças"
                  : ` nas ${value.discountCharges} primeiras cobranças`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setCode("");
          }}
          className="shrink-0 text-xs font-medium text-ink/50 hover:text-ink/80 hover:underline"
        >
          Remover
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-teal-600 hover:underline"
      >
        🎟️ Tem um cupom?
      </button>
    );
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink/70">Cupom</span>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void apply();
            }
          }}
          placeholder="Digite o código"
          autoCapitalize="characters"
          className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 uppercase outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={loading || !code.trim()}
          className="h-12 shrink-0 rounded-xl bg-teal-500 px-5 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
        >
          {loading ? "..." : "Aplicar"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
