import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { usePwaInstall } from "../lib/pwa";
import { makeQr, qrSvgPath } from "../lib/qrcode";

// Pagina publica /app — divulgacao e instalacao do app (PWA).
// Android/Chrome/Edge: botao instala direto. iPhone: passo a passo do Safari.
// Computador: QR para abrir esta pagina no celular.

const QUIET = 4;

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-500 text-sm font-bold text-white">
        {n}
      </span>
      <span className="pt-0.5 text-ink/75">{children}</span>
    </li>
  );
}

export function AppInstallPage() {
  const { canInstall, installed, ios, mobile, install } = usePwaInstall();
  const [msg, setMsg] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Baixe o app — ServiçosPro";
    return () => {
      document.title = "ServiçosPro";
    };
  }, []);

  const pageUrl = `${window.location.origin}/app`;
  const qr = useMemo(() => {
    const { modules, size } = makeQr(pageUrl, "M");
    return { path: qrSvgPath(modules), vb: size + QUIET * 2 };
  }, [pageUrl]);

  const onInstall = async () => {
    const r = await install();
    if (r === "accepted") setMsg("Pronto! O ServiçosPro está sendo instalado.");
    else if (r === "dismissed") setMsg("Instalação cancelada. Você pode tentar de novo quando quiser.");
  };

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/">
            <Logo />
          </Link>
          <Link to="/" className="text-sm font-medium text-teal-600 hover:underline">
            Abrir no navegador →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-10 text-center sm:py-14">
        <img
          src="/icon-192.png"
          alt="Ícone do ServiçosPro"
          className="mx-auto h-24 w-24 rounded-3xl shadow-lg"
        />
        <h1 className="mt-6 font-display text-3xl font-bold text-ink sm:text-4xl">
          Baixe o app ServiçosPro
        </h1>
        <p className="mt-3 text-ink/60">
          Agende, acompanhe seus horários e gerencie seu negócio direto da tela
          inicial do celular. Grátis, leve e sem ocupar espaço.
        </p>

        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-6 text-left">
          {installed ? (
            <p className="text-center font-medium text-teal-600">
              ✅ O app já está instalado neste aparelho.
            </p>
          ) : canInstall ? (
            <div className="text-center">
              <button
                type="button"
                onClick={onInstall}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-500 px-8 font-semibold text-white transition hover:bg-teal-600"
              >
                📲 Instalar app
              </button>
              <p className="mt-3 text-xs text-ink/50">
                Toque em instalar e confirme. O ícone aparece na sua tela inicial.
              </p>
            </div>
          ) : ios ? (
            <>
              <p className="font-semibold text-ink">No iPhone (Safari):</p>
              <ol className="mt-4 space-y-3 text-sm">
                <Step n={1}>
                  Toque no botão <b>Compartilhar</b> (quadrado com a seta ↑) na
                  barra do Safari.
                </Step>
                <Step n={2}>
                  Role e toque em <b>Adicionar à Tela de Início</b>.
                </Step>
                <Step n={3}>
                  Toque em <b>Adicionar</b>. Pronto, o ícone do ServiçosPro fica
                  na sua tela inicial.
                </Step>
              </ol>
              <p className="mt-4 text-xs text-ink/50">
                Se abriu este link dentro do Instagram/WhatsApp, abra antes no
                Safari (menu ⋯ → Abrir no navegador).
              </p>
            </>
          ) : mobile ? (
            <>
              <p className="font-semibold text-ink">No Android (Chrome):</p>
              <ol className="mt-4 space-y-3 text-sm">
                <Step n={1}>
                  Toque no menu <b>⋮</b> no canto superior direito do Chrome.
                </Step>
                <Step n={2}>
                  Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).
                </Step>
                <Step n={3}>Confirme em <b>Instalar</b>.</Step>
              </ol>
              <p className="mt-4 text-xs text-ink/50">
                Se abriu este link dentro do Instagram/WhatsApp, abra antes no
                Chrome (menu ⋮ → Abrir no navegador).
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0 rounded-2xl border border-ink/10 bg-white p-3">
                <svg
                  viewBox={`0 0 ${qr.vb} ${qr.vb}`}
                  className="h-40 w-40"
                  shapeRendering="crispEdges"
                  role="img"
                  aria-label="QR Code para baixar o app"
                >
                  <rect width={qr.vb} height={qr.vb} fill="#ffffff" />
                  <g transform={`translate(${QUIET} ${QUIET})`}>
                    <path d={qr.path} fill="#0f172a" />
                  </g>
                </svg>
              </div>
              <div className="text-sm text-ink/75">
                <p className="font-semibold text-ink">Instale no celular</p>
                <p className="mt-2">
                  Aponte a câmera do celular para o QR Code e siga as instruções
                  que aparecem na tela.
                </p>
                <p className="mt-3 text-xs text-ink/50">
                  No computador, você também pode instalar pelo ícone de
                  instalação na barra de endereço do Chrome/Edge.
                </p>
              </div>
            </div>
          )}

          {msg && <p className="mt-4 text-center text-sm text-teal-600">{msg}</p>}
        </div>

        <ul className="mt-8 grid gap-3 text-left text-sm sm:grid-cols-3">
          {[
            ["⚡", "Abre na hora", "Direto da tela inicial, sem digitar endereço."],
            ["📅", "Tudo à mão", "Agenda e agendamentos a um toque."],
            ["💾", "Leve", "Sem loja de apps e sem ocupar memória."],
          ].map(([icon, t, d]) => (
            <li key={t} className="rounded-2xl border border-ink/10 bg-white p-4">
              <p className="text-xl">{icon}</p>
              <p className="mt-1 font-semibold text-ink">{t}</p>
              <p className="mt-1 text-ink/60">{d}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-ink/50">
          <Link to="/" className="font-medium text-teal-600 hover:underline">
            Voltar ao ServiçosPro
          </Link>
        </p>
      </main>
    </div>
  );
}
