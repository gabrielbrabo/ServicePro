import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { LegalSection, LEGAL_UPDATED_LABEL } from "../lib/legal";

// Layout das paginas publicas de Termos de Uso e Politica de Privacidade.
export function LegalDocument({
  title,
  intro,
  sections,
  other,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
  other: { to: string; label: string };
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${title} — ServiçosPro`;
    return () => {
      document.title = "ServiçosPro";
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/">
            <Logo />
          </Link>
          <Link
            to={other.to}
            className="text-sm font-medium text-teal-600 hover:underline"
          >
            {other.label}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-ink/50">
          Última atualização: {LEGAL_UPDATED_LABEL}
        </p>
        <p className="mt-6 leading-relaxed text-ink/75">{intro}</p>

        {/* sumario */}
        <nav className="mt-8 rounded-2xl border border-ink/10 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Nesta página
          </p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.title}>
                <a
                  href={`#sec-${i + 1}`}
                  className="text-teal-600 hover:underline"
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={s.title} id={`sec-${i + 1}`} className="scroll-mt-6">
              <h2 className="font-display text-xl font-bold text-ink">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink/75">
                {s.blocks.map((b, j) =>
                  Array.isArray(b) ? (
                    <ul key={j} className="list-disc space-y-1.5 pl-5">
                      {b.map((li) => (
                        <li key={li}>{li}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j}>{b}</p>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-ink/10 pt-6 text-center text-sm text-ink/50">
          <Link to="/" className="font-medium text-teal-600 hover:underline">
            Voltar ao ServiçosPro
          </Link>
        </p>
      </main>
    </div>
  );
}
