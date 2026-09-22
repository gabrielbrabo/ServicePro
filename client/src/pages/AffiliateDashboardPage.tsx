import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Avatar } from "../components/Avatar";
import { EstablishmentAvatar } from "../components/EstablishmentAvatar";
import { authApi, User } from "../api/auth";
import {
  affiliateApi,
  Affiliate,
  AffiliateReferral,
  AffiliateSummary,
  AffiliateWallet,
} from "../api/affiliate";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents || 0) / 100);

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "active":
      return { label: "Ativo", cls: "bg-emerald-100 text-emerald-700" };
    case "trialing":
      return { label: "Em teste", cls: "bg-teal-100 text-teal-700" };
    case "past_due":
      return { label: "Atrasado", cls: "bg-amber-100 text-amber-700" };
    case "canceled":
      return { label: "Cancelado", cls: "bg-rose-100 text-rose-700" };
    default:
      return { label: "Pendente", cls: "bg-ink/10 text-ink/60" };
  }
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        accent ? "border-teal-500/20 bg-teal-500/5" : "border-ink/10 bg-white"
      }`}
    >
      <p className="text-sm font-medium text-ink/50">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${
          accent ? "text-teal-600" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink/40">{hint}</p>}
    </div>
  );
}

function ShareLink({
  value,
  onCopy,
  copied,
  dark,
}: {
  value: string;
  onCopy: () => void;
  copied: boolean;
  dark?: boolean;
}) {
  const share = async () => {
    const nav = navigator as Navigator & {
      share?: (data: { url?: string; text?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ url: value });
        return;
      } catch {
        /* usuário cancelou */
      }
    }
    onCopy();
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={
          dark
            ? "h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-white outline-none"
            : "h-12 w-full rounded-xl border border-ink/15 bg-ink/5 px-4 text-ink outline-none"
        }
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCopy}
          className={
            dark
              ? "h-12 flex-1 rounded-xl bg-white px-5 font-semibold text-teal-700 transition hover:bg-teal-50 sm:flex-none"
              : "h-12 flex-1 rounded-xl bg-teal-500 px-5 font-semibold text-white transition hover:bg-teal-600 sm:flex-none"
          }
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
        <button
          type="button"
          onClick={share}
          className={
            dark
              ? "h-12 flex-1 rounded-xl border border-white/30 px-5 font-semibold text-white transition hover:bg-white/10 sm:flex-none"
              : "h-12 flex-1 rounded-xl border border-ink/15 px-5 font-semibold text-ink/70 transition hover:bg-ink/5 sm:flex-none"
          }
        >
          Compartilhar
        </button>
      </div>
    </div>
  );
}

function Header({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-ink/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-600 sm:inline">
            Afiliado/Representante
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <Avatar name={user.name} src={user.avatar} size={36} />
              <span className="hidden text-sm font-medium text-ink sm:inline">
                {user.name}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-ink/5"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

export function AffiliateDashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [aff, setAff] = useState<Affiliate | null>(null);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [wallet, setWallet] = useState<AffiliateWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEst, setCopiedEst] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      affiliateApi.referrals(),
      authApi.me().catch(() => null),
      affiliateApi.wallet().catch(() => null),
    ])
      .then(([data, u, w]) => {
        setAff(data.affiliate);
        setSummary(data.summary);
        setReferrals(data.referrals);
        setUser(u);
        setWallet(w);
      })
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        navigate(status === 404 ? "/seja-afiliado" : "/afiliado/login");
      });
  }, [navigate]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const recheck = async () => {
    setChecking(true);
    await load();
    setChecking(false);
  };

  const copy = async (text: string, setFlag: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch {
      /* ignora */
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/afiliado/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink/50">
        Carregando...
      </div>
    );
  }
  if (!aff || !summary) return null;

  const asaasUrl = wallet?.asaasLoginUrl || "https://www.asaas.com/login";

  // Conta Asaas ainda não aprovada: NÃO libera o link — orienta a ativar/enviar
  // documentos e conferir de novo.
  if (!aff.approved) {
    return (
      <div className="min-h-screen bg-ink/5">
        <Header user={user} onLogout={logout} />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <section className="rounded-2xl border border-amber-300/50 bg-amber-50/60 p-6 sm:p-8">
            <span className="inline-block rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-700">
              Conta em aprovação
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">
              Falta ativar sua conta de recebimento
            </h1>
            <p className="mt-2 text-ink/70">
              Criamos sua conta de recebimento no Asaas. Para liberar seu{" "}
              <strong>link de indicação</strong> e começar a ganhar comissões,
              você precisa ativá-la:
            </p>
            <ol className="mt-4 space-y-2 text-sm text-ink/70">
              <li>
                <strong>1.</strong> Abra o <strong>e-mail do Asaas</strong> (no
                endereço que você usou no cadastro) e confirme o acesso.
              </li>
              <li>
                <strong>2.</strong> Envie os <strong>documentos</strong> pedidos
                para verificação da conta.
              </li>
              <li>
                <strong>3.</strong> Assim que o Asaas <strong>aprovar</strong>,
                volte aqui e toque em “Já ativei”.
              </li>
            </ol>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <a
                href={asaasUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
              >
                Abrir o Asaas ↗
              </a>
              <button
                type="button"
                onClick={recheck}
                disabled={checking}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-ink/15 px-6 font-semibold text-ink/70 transition hover:bg-ink/5 disabled:opacity-60"
              >
                {checking ? "Verificando..." : "Já ativei — verificar"}
              </button>
            </div>
            <p className="mt-4 text-xs text-ink/50">
              Seu link de indicação só é liberado depois que a conta é aprovada —
              assim garantimos que sua comissão sempre cai certinho.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const firstName = user?.name?.split(/\s+/)[0] || "afiliado";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const establishmentLink = `${origin}/painel?ref=${aff.code}`;

  return (
    <div className="min-h-screen bg-ink/5">
      <Header user={user} onLogout={logout} />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* Hero: link de indicação */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 p-6 text-white shadow-sm sm:p-8">
          <p className="text-sm font-medium text-teal-100/80">Olá, {firstName} 👋</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Seu link de indicação
          </h1>
          <p className="mt-1 max-w-xl text-teal-50/80">
            Compartilhe e ganhe {aff.commissionPercent}% de cada plano que seus
            indicados pagarem, para sempre.
          </p>
          <div className="mt-4">
            <ShareLink
              value={aff.link}
              onCopy={() => copy(aff.link, setCopied)}
              copied={copied}
              dark
            />
          </div>
        </section>

        {/* Saldo + saque no Asaas */}
        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink/50">
                Saldo disponível no Asaas
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-ink">
                {wallet?.canReadBalance ? brl(wallet.balanceCents) : "—"}
              </p>
            </div>
            <a
              href={asaasUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
            >
              Sacar no Asaas ↗
            </a>
          </div>
          <p className="mt-3 text-xs text-ink/50">
            O saque é feito <strong>dentro do Asaas</strong>, na sua conta de
            recebimento. Acesse com o <strong>e-mail do seu cadastro</strong>.
            {wallet?.freeWithdrawalsPerMonth
              ? ` Você tem ${wallet.freeWithdrawalsPerMonth} saque(s) grátis por mês.`
              : " As taxas de transferência seguem as condições do Asaas."}
          </p>
        </section>

        {/* Convide um estabelecimento */}
        <section className="rounded-2xl border border-teal-500/20 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-lg">
              🏪
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-ink">
                Convide um estabelecimento
              </h2>
              <p className="mt-0.5 text-sm text-ink/60">
                Envie este link para um negócio. Ele já abre o cadastro com a sua
                indicação preenchida — você recebe a comissão automaticamente.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <ShareLink
              value={establishmentLink}
              onCopy={() => copy(establishmentLink, setCopiedEst)}
              copied={copiedEst}
            />
          </div>
        </section>

        {/* Indicadores */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Indicados" value={summary.total} />
          <StatCard label="Ativos agora" value={summary.active} />
          <StatCard
            label="Recebido este mês"
            value={brl(summary.receivedMonthCents)}
            hint={`Total recebido: ${brl(summary.receivedTotalCents)}`}
            accent
          />
          <StatCard
            label="Previsto / mês"
            value={brl(summary.monthlyEstimateCents)}
            hint={`${summary.commissionPercent}% dos planos ativos`}
          />
        </section>

        {/* Lista de indicados */}
        <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">
              Seus indicados
            </h2>
            <span className="text-xs text-ink/50">
              Comissão de {summary.commissionPercent}% por indicado
            </span>
          </div>

          {referrals.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-ink/20 bg-ink/[0.02] p-8 text-center">
              <p className="font-semibold text-ink/70">
                Você ainda não tem indicados
              </p>
              <p className="mt-1 text-sm text-ink/50">
                Compartilhe seus links acima. Quando um estabelecimento se
                cadastrar por eles e assinar um plano, aparece aqui.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {referrals.map((r) => {
                const badge = statusBadge(r.status);
                return (
                  <li
                    key={r.subscriptionId}
                    className="flex items-center gap-3 rounded-xl border border-ink/10 p-3 transition hover:border-teal-500/40"
                  >
                    <EstablishmentAvatar
                      name={r.establishmentName}
                      src={r.establishmentPhoto}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">
                        {r.establishmentName}
                      </p>
                      <p className="truncate text-xs text-ink/50">
                        {r.planName} · {r.billingCycle} · {brl(r.priceCents)}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-semibold text-teal-600">
                        {brl(r.commissionCents)}
                      </p>
                      <p className="text-xs text-ink/40">
                        sua comissão ({r.commissionPercent}%)
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="pb-6 text-center text-xs text-ink/40">
          As comissões caem automaticamente na sua conta de recebimento a cada
          pagamento confirmado. O saque é feito dentro do Asaas.
        </p>
      </main>
    </div>
  );
}
