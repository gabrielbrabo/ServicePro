import { ReactNode } from "react";
import { Logo } from "../components/Logo";

// dois publicos do sistema, cada um com seus diferenciais
const audiences = [
  {
    tag: "Para quem contrata",
    icon: "🔍",
    points: [
      "Ache profissionais perto de você, por raio de distância (km)",
      "Agende em horários livres na hora, sem troca de mensagens",
    ],
  },
  {
    tag: "Para estabelecimentos",
    icon: "📈",
    points: [
      "Seja encontrado por novos clientes da sua região",
      "Agenda, ordens de serviço, caixa e ficha do cliente num só painel",
    ],
  },
];

// apresentacao em PDF de cada area (arquivos em client/public/apresentacoes)
const PDF_BASE = "/apresentacoes";

// as tres areas do sistema e exemplos de categorias (mostra a variedade)
const areas = [
  {
    name: "Beleza & bem-estar",
    pdf: `${PDF_BASE}/servicospro-beleza.pdf`,
    tags: ["Barbearia", "Salão", "Estética", "Manicure", "Sobrancelha", "Cílios"],
  },
  {
    name: "Saúde",
    pdf: `${PDF_BASE}/servicospro-saude.pdf`,
    tags: ["Odontologia", "Fisioterapia", "Quiropraxia", "Enfermagem", "Psicologia", " Nutrição"],
  },
  {
    name: "Serviços gerais",
    pdf: `${PDF_BASE}/servicospro-servicos-gerais.pdf`,
    tags: ["Oficina", "Reformas", "Jardinagem", "Aulas", "Fotografia", "Limpeza"],
  },
];

// Painel da marca para AFILIADOS/REPRESENTANTES: foco em ganhar comissao
// indicando estabelecimentos (e nao em contratar/gerenciar servicos).
const affiliateGains = [
  {
    icon: "💰",
    title: "25% de comissão recorrente",
    text: "Sobre a assinatura de cada estabelecimento que você indicar, todo mês ou renovação anual, enquanto ele continuar pagando.",
  },
  {
    icon: "⚡",
    title: "Cai direto na sua conta",
    text: "A comissão é separada no pagamento e vai para a sua conta de recebimento. O saque é feito lá, quando você quiser.",
  },
  {
    icon: "🔗",
    title: "Seu link de indicação",
    text: "Envie para salões, clínicas, oficinas e prestadores. O cadastro já chega com a sua indicação.",
  },
  {
    icon: "📊",
    title: "Painel com tudo em tempo real",
    text: "Veja seus indicados, quem está ativo, quanto recebeu no mês e a previsão de ganhos.",
  },
];

// preco dos planos de cada area (espelha config/segments.ts; anual = 10x o mensal)
const planPrices = [
  { area: "Beleza & bem-estar", monthly: "R$ 69", annual: "R$ 690" },
  { area: "Saúde", monthly: "R$ 159", annual: "R$ 1.590" },
  { area: "Serviços gerais", monthly: "R$ 69", annual: "R$ 690" },
];

function AffiliatePitch() {
  return (
    <div className="relative z-10 my-8">
      <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-300">
        Indicar · Acompanhar · Receber
      </span>
      <h2 className="mt-4 max-w-md font-display text-4xl font-bold leading-tight">
        Indique estabelecimentos e ganhe todo mês.
      </h2>
      <p className="mt-3 max-w-md text-teal-50/80">
        Como afiliado ou representante do ServiçosPro, você apresenta o sistema
        para negócios da sua região e recebe comissão recorrente por cada
        assinatura ativa.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {affiliateGains.map((g) => (
          <div
            key={g.title}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <span aria-hidden="true">{g.icon}</span>
              {g.title}
            </p>
            <p className="mt-1.5 text-sm text-teal-50/85">{g.text}</p>
          </div>
        ))}
      </div>

      {/* quanto rende cada indicacao */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-100/60">
          Quanto custam os planos de cada estabelecimento
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {planPrices.map((p) => (
            <div
              key={p.area}
              className="rounded-xl bg-white/10 px-3 py-2.5 text-sm text-teal-50/90"
            >
              <p className="font-semibold text-white">{p.area}</p>
              <p className="mt-1">
                <b className="text-amber-300">{p.monthly}</b>/mês
              </p>
              <p className="text-xs text-teal-100/75">
                ou <b className="text-amber-300">{p.annual}</b>/ano
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-teal-100/70">
          Quanto mais indicados ativos, maior a sua renda. As apresentações de
          cada área estão prontas para você mostrar aos estabelecimentos.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <a
              key={a.name}
              href={a.pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-ink transition hover:bg-amber-300"
            >
              📄 {a.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthLayout({
  children,
  title,
  subtitle,
  variant = "app",
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  // "affiliate": painel da marca voltado a afiliados/representantes
  variant?: "app" | "affiliate";
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Painel da marca */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-teal-700 p-12 text-white lg:flex">
        <Logo className="[&_span:last-child]:text-white [&_.text-teal-500]:text-amber-400" />

        {variant === "affiliate" ? (
          <AffiliatePitch />
        ) : (
        <div className="relative z-10 my-8">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-300">
            Encontrar · Agendar · Gerenciar
          </span>
          <h2 className="mt-4 max-w-md font-display text-4xl font-bold leading-tight">
            Serviços de confiança, perto de você.
          </h2>
          <p className="mt-3 max-w-md text-teal-50/80">
            Um só lugar para contratar profissionais da sua região e para
            estabelecimentos crescerem com agenda e gestão completas.
          </p>

          {/* dois publicos */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {audiences.map((a) => (
              <div
                key={a.tag}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <span aria-hidden="true">{a.icon}</span>
                  {a.tag}
                </p>
                <ul className="mt-2 space-y-2">
                  {a.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2 text-sm text-teal-50/90"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-amber-300"
                      >
                        ✓
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* areas e categorias */}
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-100/60">
              Para todas as áreas
            </p>
            <div className="mt-3 space-y-2">
              {areas.map((area) => (
                <div key={area.name} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {area.name}
                  </span>
                  {area.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-teal-50/80"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="text-xs italic text-teal-100/70">
                    e muitas outras
                  </span>
                  {/* apresentacao completa da area (abre em nova aba) */}
                  <a
                    href={area.pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-ink transition hover:bg-amber-300"
                  >
                    📄 Ver apresentação
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        <p className="relative z-10 text-sm text-teal-100/70">
          © {new Date().getFullYear()} ServiçosPro
        </p>

        {/* ornamento de fundo */}
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-teal-600/50 blur-2xl" />
        <div className="pointer-events-none absolute -top-16 right-12 h-40 w-40 rounded-full bg-amber-400/20 blur-2xl" />
      </aside>

      {/* Formulario */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
          <p className="mt-2 text-ink/60">{subtitle}</p>
          <div className="mt-8">{children}</div>

          {/* celular/tablet: o painel da marca (com os PDFs) fica escondido,
              entao as apresentacoes aparecem discretas no rodape, abaixo do
              formulario — nao atrapalham o login/cadastro */}
          <footer className="mt-10 border-t border-ink/10 pt-5 lg:hidden">
            <p className="text-center text-xs font-medium text-ink/50">
              {variant === "affiliate"
                ? "Apresentações para mostrar aos estabelecimentos:"
                : "Tem um negócio? Conheça o ServiçosPro para a sua área:"}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {areas.map((area) => (
                <a
                  key={area.name}
                  href={area.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
                >
                  📄 {area.name}
                </a>
              ))}
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
