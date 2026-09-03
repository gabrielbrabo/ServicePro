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

// as tres areas do sistema e exemplos de categorias (mostra a variedade)
const areas = [
  {
    name: "Beleza & bem-estar",
    tags: ["Barbearia", "Salão", "Estética", "Manicure", "Sobrancelha", "Cílios"],
  },
  {
    name: "Saúde",
    tags: ["Odontologia", "Fisioterapia", "Quiropraxia", "Enfermagem", "Psicologia", " Nutrição"],
  },
  {
    name: "Serviços gerais",
    tags: ["Oficina", "Reformas", "Jardinagem", "Aulas", "Fotografia", "Limpeza"],
  },
];

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Painel da marca */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-teal-700 p-12 text-white lg:flex">
        <Logo className="[&_span:last-child]:text-white [&_.text-teal-500]:text-amber-400" />

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
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative z-10 text-sm text-teal-100/70">
          © {new Date().getFullYear()} ServiçoPro
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
        </div>
      </main>
    </div>
  );
}
