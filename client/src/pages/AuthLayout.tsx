import { ReactNode } from "react";
import { Logo } from "../components/Logo";

const highlights = [
  "Anuncie seus serviços e seja encontrado",
  "Agende em horários livres, sem troca de mensagens",
  "Acompanhe pedidos e converse em tempo real",
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

        <div className="relative z-10">
          <h2 className="max-w-md font-display text-4xl font-bold leading-tight">
            O jeito simples de contratar e oferecer serviços.
          </h2>
          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-center gap-3 text-teal-50">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-400 text-xs font-bold text-ink">
                  ✓
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-teal-100/70">
          © {new Date().getFullYear()} ServicePro
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
