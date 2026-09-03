import { useEffect, useMemo, useState } from "react";
import { makeQr, qrSvgPath } from "../lib/qrcode";

// ---------------------------------------------------------------------------
// Modal reutilizavel de QR Code + link. Usado para divulgar o estabelecimento
// e para o link/QR proprio de cada profissional (com ele ja pre-selecionado no
// agendamento). Permite copiar o link, baixar como PNG e imprimir.
// ---------------------------------------------------------------------------

const QUIET = 4; // margem clara (modulos) exigida pela leitura do QR

function drawToCanvas(
  modules: boolean[][],
  scale = 16
): HTMLCanvasElement {
  const n = modules.length;
  const dim = (n + QUIET * 2) * scale;
  const canvas = document.createElement("canvas");
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = "#0f172a";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules[y][x]) {
        ctx.fillRect((x + QUIET) * scale, (y + QUIET) * scale, scale, scale);
      }
    }
  }
  return canvas;
}

export function QrShareModal({
  title,
  subtitle,
  url,
  onClose,
}: {
  title: string;
  subtitle?: string;
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // compartilhamento nativo (mobile): permite mandar direto para Instagram,
  // WhatsApp, etc — inclusive a IMAGEM do QR quando o dispositivo suporta.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const { modules, size } = useMemo(() => makeQr(url, "M"), [url]);
  const path = useMemo(() => qrSvgPath(modules), [modules]);
  const vb = size + QUIET * 2;

  const shareText = subtitle ? `${subtitle} — ${url}` : url;
  const enc = encodeURIComponent;
  const networks: { label: string; href: string; cls: string }[] = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${enc(shareText)}`,
      cls: "bg-[#25D366] text-white hover:brightness-95",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      cls: "bg-[#1877F2] text-white hover:brightness-95",
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(subtitle || title)}`,
      cls: "bg-[#229ED9] text-white hover:brightness-95",
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(subtitle || title)}`,
      cls: "bg-ink text-white hover:brightness-125",
    },
  ];

  const nativeShare = async () => {
    try {
      // tenta compartilhar a IMAGEM do QR (melhor para redes visuais)
      const canvas = drawToCanvas(modules, 16);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/png")
      );
      const file = blob
        ? new File([blob], "qrcode.png", { type: "image/png" })
        : null;
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
      };
      if (file && nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ title, text: shareText, files: [file] });
        return;
      }
      await navigator.share({ title, text: shareText, url });
    } catch {
      /* usuario cancelou ou nao suportado — sem acao */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponivel: usuario pode selecionar o campo manualmente */
    }
  };

  const filename =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "qrcode";

  const downloadPng = () => {
    const canvas = drawToCanvas(modules, 16);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const print = () => {
    const dataUrl = drawToCanvas(modules, 16).toDataURL("image/png");
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; margin: 0; padding: 32px;
               display: flex; flex-direction: column; align-items: center;
               justify-content: center; min-height: 100vh; text-align: center; }
        h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
        p { color: #475569; margin: 0 0 20px; font-size: 14px; }
        img { width: 320px; height: 320px; image-rendering: pixelated; }
        .url { margin-top: 16px; font-size: 12px; color: #14b8a6;
               word-break: break-all; max-width: 360px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ""}
      <img src="${dataUrl}" alt="QR Code" />
      <div class="url">${url}</div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };<\/script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink/60">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-ink/40 transition hover:bg-ink/5 hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* QR em SVG (nitido em qualquer tamanho) */}
        <div className="mt-4 flex justify-center">
          <div className="rounded-2xl border border-ink/10 bg-white p-4">
            <svg
              viewBox={`0 0 ${vb} ${vb}`}
              className="h-56 w-56"
              shapeRendering="crispEdges"
              role="img"
              aria-label={`QR Code para ${title}`}
            >
              <rect width={vb} height={vb} fill="#ffffff" />
              <g transform={`translate(${QUIET} ${QUIET})`}>
                <path d={path} fill="#0f172a" />
              </g>
            </svg>
          </div>
        </div>

        {/* link */}
        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-sand/40 px-3 py-2 text-xs text-ink/70 outline-none"
          />
          <button
            onClick={copyLink}
            className="shrink-0 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-ink transition hover:bg-amber-500"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>

        {/* compartilhar nas redes */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink/50">Compartilhar</p>
          <div className="flex flex-wrap gap-2">
            {canNativeShare && (
              <button
                onClick={nativeShare}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 5a3 3 0 10-2.83-4H10a3 3 0 002.83 4zM6 12a3 3 0 100-4 3 3 0 000 4zm7 6a3 3 0 10.001-5.999A3 3 0 0013 18z" />
                  <path d="M8.6 9.2l4.2-2.4M8.6 10.8l4.2 2.4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                Compartilhar…
              </button>
            )}
            {networks.map((n) => (
              <a
                key={n.label}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${n.cls}`}
              >
                {n.label}
              </a>
            ))}
          </div>
        </div>

        {/* acoes */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={downloadPng}
            className="rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-semibold text-ink/80 transition hover:bg-sand"
          >
            Baixar PNG
          </button>
          <button
            onClick={print}
            className="rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-semibold text-ink/80 transition hover:bg-sand"
          >
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
