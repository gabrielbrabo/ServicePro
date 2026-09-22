import { useEffect, useMemo, useRef, useState } from "react";
import { publicAgendaApi, AgendaMonth, AgendaDay } from "../api/publicAgenda";
import {
  currentMonthStr,
  monthLabel,
  addMonth,
  todayStr,
  freeCount,
} from "../lib/agenda";

// ---------------------------------------------------------------------------
// Modal de divulgacao da AGENDA. Gera automaticamente um BANNER (PNG) no formato
// de AGENDA (nao calendario): cada dia lista os HORARIOS reais, verdes quando
// livres e cinzas/riscados quando ocupados. Cabecalho com a FOTO do perfil e um
// unico CTA "Agende agora" (a pagina publica /agenda/:id[?prof=] redireciona o
// cliente para o agendamento).
// ---------------------------------------------------------------------------

const WD = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const C = {
  bgTop: "#ffffff",
  bgBottom: "#eef2f7",
  card: "#ffffff",
  ink: "#0f1b1a",
  inkSoft: "#475569",
  faint: "#94a3b8",
  white: "#ffffff",
  teal900: "#053430",
  teal700: "#084A44",
  teal600: "#0B645C",
  teal500: "#0E7C72",
  teal100: "#CFE3E1",
  teal50: "#EAF3F2",
  livre: "#0E7C72",
  ocupBg: "#eef2f6",
  ocupTx: "#9aa6b2",
  amber: "#E8A21C",
  amberLight: "#F2B441",
  shadow: "rgba(15,27,26,0.10)",
};

// Cor da agenda divulgada. O usuario escolhe QUALQUER cor (grade grande + um
// seletor livre). A partir da cor-base geramos automaticamente os 6 tons do
// banner — do escuro do cabecalho aos claros dos cartoes — sempre legiveis.
type Palette = {
  c900: string;
  c700: string;
  c600: string;
  c500: string;
  c100: string;
  c50: string;
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = (hex || "").replace("#", "");
  const n =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m.padEnd(6, "0").slice(0, 6);
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const S = Math.max(0, Math.min(100, s)) / 100;
  const L = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = L - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + mm) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Deriva os 6 tons do banner de uma cor-base, fixando a luminosidade de cada tom
// e mantendo o matiz -> contraste garantido em qualquer cor escolhida.
function shadesFromHex(base: string): Palette {
  const { h, s } = hexToHsl(base);
  const sat = Math.max(35, Math.min(s, 85)); // evita cor "lavada" ou neon
  return {
    c900: hslToHex(h, Math.min(sat + 8, 90), 14),
    c700: hslToHex(h, sat, 24),
    c600: hslToHex(h, sat, 32),
    c500: hslToHex(h, sat, 42),
    c100: hslToHex(h, Math.max(sat - 25, 30), 86),
    c50: hslToHex(h, Math.max(sat - 30, 25), 95),
  };
}

// grade de cores prontas (o usuario tambem pode escolher QUALQUER cor no seletor)
const BASE_COLORS = [
  "#0E7C72", "#0D9488", "#059669", "#16A34A", "#65A30D",
  "#CA8A04", "#D97706", "#EA580C", "#DC2626", "#E11D48",
  "#DB2777", "#C026D3", "#9333EA", "#7C3AED", "#6D28D9",
  "#4F46E5", "#2563EB", "#0284C7", "#0891B2", "#14B8A6",
  "#475569", "#334155", "#1F2937", "#0F172A",
];

const DEFAULT_HEX = "#0E7C72";
const DEFAULT_PALETTE: Palette = shadesFromHex(DEFAULT_HEX);

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

function fit(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  mw: number,
  px: number,
  weight: string
) {
  let p = px;
  const f = (q: number) => `${weight} ${q}px system-ui, -apple-system, sans-serif`;
  ctx.font = f(p);
  while (ctx.measureText(t).width > mw && p > 14) {
    p -= 2;
    ctx.font = f(p);
  }
  ctx.fillText(t, x, y);
}

// desenha o banner (1080x1350) no formato de agenda
function drawBanner(
  canvas: HTMLCanvasElement,
  data: AgendaMonth,
  img: HTMLImageElement | null,
  pal: Palette = DEFAULT_PALETTE
): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const today = todayStr();

  // fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.bgTop);
  bg.addColorStop(1, C.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // cabecalho
  const headerH = 232;
  const hg = ctx.createLinearGradient(0, 0, W, headerH);
  hg.addColorStop(0, pal.c700);
  hg.addColorStop(1, pal.c500);
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.arc(W - 110, 40, 200, 0, Math.PI * 2);
  ctx.fill();

  const title = data.professionalName || data.establishmentName;

  // foto de perfil (redonda). Sem foto (ou CORS falhou) => inicial.
  const pR = 66;
  const pCx = 52 + pR;
  const pCy = 42 + pR;
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pCx, pCy, pR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const s = Math.max((pR * 2) / img.width, (pR * 2) / img.height);
    const iw = img.width * s;
    const ih = img.height * s;
    ctx.drawImage(img, pCx - iw / 2, pCy - ih / 2, iw, ih);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(pCx, pCy, pR, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = pal.c900;
    ctx.beginPath();
    ctx.arc(pCx, pCy, pR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = C.white;
    ctx.font = "700 58px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((title || "?").trim().charAt(0).toUpperCase(), pCx, pCy + 2);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const tx = 52 + pR * 2 + 30;
  ctx.fillStyle = pal.c100;
  ctx.font = "700 26px system-ui, -apple-system, sans-serif";
  ctx.fillText("HORÁRIOS DISPONÍVEIS", tx, 98);
  ctx.fillStyle = C.white;
  fit(ctx, title, tx, 162, W - tx - 56, 48, "700");

  const openDays = data.days.filter(
    (d) => d.date >= today && d.working && freeCount(d) > 0
  );

  const cardX = 40;
  const cardTop = 262;
  const cardW = W - 80;
  const cpad = 26;
  const listX = cardX + cpad;
  const listBottomLimit = H - 106; // usa o maximo de espaco; so o rodape embaixo
  const chipH = 42;
  const chipGap = 9;
  const chipPadX = 18;
  const badgeW = 92;
  const badgeGap = 20;
  const chipsX = listX + badgeW + badgeGap;
  const chipsW = cardW - cpad * 2 - badgeW - badgeGap;

  const chipW = (t: string): number => {
    ctx.font = "700 22px system-ui, -apple-system, sans-serif";
    return Math.ceil(ctx.measureText(t).width) + chipPadX * 2;
  };
  const layoutDay = (d: AgendaDay): number => {
    let lineW = 0;
    let lines = 1;
    for (const s of d.slots) {
      if (!s.free) continue;
      const w = chipW(s.t);
      if (lineW + w > chipsW) {
        lines++;
        lineW = w + chipGap;
      } else {
        lineW += w + chipGap;
      }
    }
    return Math.max(84, lines * chipH + (lines - 1) * chipGap) + 28;
  };

  const monthTxt = monthLabel(data.month).split(" ")[0];
  let yPos = cardTop + cpad + 34; // espaco para o mes acima da lista
  const drawn: { d: AgendaDay; y: number; rowH: number }[] = [];
  for (const d of openDays) {
    const rowH = layoutDay(d);
    if (yPos + rowH > listBottomLimit) break;
    drawn.push({ d, y: yPos, rowH });
    yPos += rowH;
  }
  const remaining = openDays.length - drawn.length;
  const emptyMsg = drawn.length === 0;
  const cardH =
    (emptyMsg ? 150 : yPos - cardTop) + (remaining > 0 ? 54 : 0) + cpad - 14;

  ctx.fillStyle = C.shadow;
  roundRect(ctx, cardX, cardTop + 8, cardW, cardH, 26);
  ctx.fill();
  ctx.fillStyle = C.card;
  roundRect(ctx, cardX, cardTop, cardW, cardH, 26);
  ctx.fill();

  // mes (pequeno, acima dos horarios, a esquerda)
  if (!emptyMsg) {
    ctx.fillStyle = pal.c600;
    ctx.font = "800 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(monthTxt.toUpperCase(), listX, cardTop + cpad + 20);
  }

  if (emptyMsg) {
    ctx.fillStyle = C.faint;
    ctx.font = "600 30px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Sem horários livres por enquanto", W / 2, cardTop + cardH / 2);
  }

  drawn.forEach(({ d, y, rowH }, idx) => {
    const dayNum = Number(d.date.slice(-2));
    if (idx > 0) {
      ctx.strokeStyle = "#eef2f6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(listX, y - 1);
      ctx.lineTo(cardX + cardW - cpad, y - 1);
      ctx.stroke();
    }
    const bh = 76;
    const by = y + (rowH - bh) / 2;
    ctx.fillStyle = pal.c50;
    roundRect(ctx, listX, by, badgeW, bh, 16);
    ctx.fill();
    ctx.fillStyle = pal.c600;
    ctx.font = "700 20px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(WD[d.dow], listX + badgeW / 2, by + 28);
    ctx.fillStyle = pal.c700;
    ctx.font = "800 38px system-ui, -apple-system, sans-serif";
    ctx.fillText(String(dayNum), listX + badgeW / 2, by + 64);

    const rows = Math.round((rowH - 28) / (chipH + chipGap));
    let cxp = chipsX;
    let cyp = y + (rowH - (rows * chipH + (rows - 1) * chipGap)) / 2 + chipH / 2;
    ctx.textBaseline = "middle";
    for (const s of d.slots) {
      if (!s.free) continue; // so horarios disponiveis
      const w = chipW(s.t);
      if (cxp + w > chipsX + chipsW) {
        cxp = chipsX;
        cyp += chipH + chipGap;
      }
      roundRect(ctx, cxp, cyp - chipH / 2, w, chipH, 12);
      ctx.fillStyle = pal.c500;
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.font = "700 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.t, cxp + w / 2, cyp + 1);
      ctx.textAlign = "left";
      cxp += w + chipGap;
    }
  });

  if (remaining > 0) {
    ctx.fillStyle = C.inkSoft;
    ctx.font = "600 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      `+ ${remaining} dia${remaining !== 1 ? "s" : ""} com mais horários`,
      W / 2,
      yPos + 34
    );
  }

  // rodape (marca)
  ctx.fillStyle = pal.c600;
  ctx.font = "800 30px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ServiçosPro", W / 2, H - 30);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function AgendaShareModal({
  establishmentId,
  establishmentName,
  professionalName,
  professionalId,
  onClose,
}: {
  establishmentId: string;
  establishmentName: string;
  professionalName?: string | null;
  professionalId?: string | null;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(currentMonthStr());
  const [data, setData] = useState<AgendaMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // cor escolhida para o banner da agenda. Lembra a ultima escolha por
  // estabelecimento (no proprio navegador).
  const colorKeyStore = `sp_agenda_color_${establishmentId}`;
  const [colorHex, setColorHex] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(colorKeyStore);
      // versoes antigas guardavam uma "key" (ex.: "teal"); so aceitamos hex.
      return saved && saved.startsWith("#") ? saved : DEFAULT_HEX;
    } catch {
      return DEFAULT_HEX;
    }
  });
  const palette = useMemo(() => shadesFromHex(colorHex), [colorHex]);
  const pickColor = (hex: string) => {
    setColorHex(hex);
    try {
      localStorage.setItem(colorKeyStore, hex);
    } catch {
      /* ignora */
    }
  };

  const url = useMemo(() => {
    const base = `${window.location.origin}/agenda/${establishmentId}`;
    return professionalId ? `${base}?prof=${professionalId}` : base;
  }, [establishmentId, professionalId]);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    publicAgendaApi
      .get(establishmentId, { prof: professionalId, mes: month })
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [establishmentId, professionalId, month]);

  // (re)desenha o banner quando os dados mudam; carrega a foto antes (CORS-safe)
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      let img: HTMLImageElement | null = null;
      if (data.photo) {
        // carrega a foto pelo proxy do backend (CORS-safe p/ exportar o canvas)
        try {
          img = await loadImage(
            publicAgendaApi.photoUrl(establishmentId, professionalId)
          );
        } catch {
          img = null;
        }
      }
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      drawBanner(canvas, data, img, palette);
      canvasRef.current = canvas;
      setPreviewUrl(canvas.toDataURL("image/png"));
    })();
    return () => {
      cancelled = true;
    };
    // redesenha quando os dados OU a cor escolhida mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, colorHex]);

  const estName = data?.establishmentName || establishmentName;
  const proName = data?.professionalName ?? professionalName ?? null;

  const filename = useMemo(() => {
    const base = (proName || estName || "agenda")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `agenda-${base || "agenda"}-${month}`;
  }, [proName, estName, month]);

  const shareText = proName
    ? `📅 Agende comigo em ${estName}! Veja os horários: ${url}`
    : `📅 Agende em ${estName}! Veja os horários disponíveis: ${url}`;
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
      label: "Instagram",
      href: "#",
      cls: "bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white hover:brightness-95",
    },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponivel */
    }
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const nativeShare = async () => {
    const canvas = canvasRef.current;
    try {
      if (canvas) {
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob((b) => res(b), "image/png")
        );
        const file = blob
          ? new File([blob], `${filename}.png`, { type: "image/png" })
          : null;
        const nav = navigator as Navigator & {
          canShare?: (d: { files?: File[] }) => boolean;
        };
        if (file && nav.canShare && nav.canShare({ files: [file] })) {
          await navigator.share({ title: estName, text: shareText, files: [file] });
          return;
        }
      }
      await navigator.share({ title: estName, text: shareText, url });
    } catch {
      /* usuario cancelou ou nao suportado */
    }
  };

  const canPrev = addMonth(month, -1) >= currentMonthStr();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink">
              Divulgar agenda
            </h2>
            <p className="mt-0.5 text-sm text-ink/60">
              Poste a imagem e receba agendamentos pelo link.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-ink/40 transition hover:bg-ink/5 hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* seletor de mes */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-sand/60 px-3 py-2">
          <button
            type="button"
            onClick={() => canPrev && setMonth((m) => addMonth(m, -1))}
            disabled={!canPrev}
            aria-label="Mês anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/60 transition hover:bg-white disabled:opacity-30"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-ink">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonth(m, 1))}
            aria-label="Próximo mês"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/60 transition hover:bg-white"
          >
            ›
          </button>
        </div>

        {/* escolha da cor do banner da agenda */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink/60">Cor da agenda</p>
          <div className="flex flex-wrap items-center gap-2">
            {BASE_COLORS.map((hex) => {
              const active = hex.toLowerCase() === colorHex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => pickColor(hex)}
                  aria-label={`Cor ${hex}`}
                  aria-pressed={active}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    active
                      ? "border-ink ring-2 ring-ink/20"
                      : "border-white shadow-sm hover:scale-105"
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}

            {/* seletor livre: QUALQUER cor */}
            <label
              title="Escolher qualquer cor"
              className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-ink/30 text-ink/50 transition hover:border-ink/60"
              style={{
                background:
                  "conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899,#ef4444)",
              }}
            >
              <span className="text-sm font-bold text-white drop-shadow">+</span>
              <input
                type="color"
                value={colorHex}
                onChange={(e) => pickColor(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Escolher qualquer cor"
              />
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-ink/40">
            Toque no <strong>+</strong> para escolher qualquer cor.
          </p>
        </div>

        {/* preview do banner */}
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-ink/10 bg-sand">
          {error ? (
            <div className="grid aspect-[4/5] place-items-center p-6 text-center text-sm text-ink/50">
              Não foi possível carregar a agenda.
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Banner da agenda" className="w-full" />
          ) : (
            <div className="grid aspect-[4/5] place-items-center text-sm text-ink/40">
              Gerando banner...
            </div>
          )}
          {loading && previewUrl && (
            <div className="absolute inset-0 grid place-items-center bg-white/40 text-sm font-medium text-ink/60">
              Atualizando...
            </div>
          )}
        </div>

        {/* baixar imagem / compartilhar imagem */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={downloadPng}
            disabled={!previewUrl}
            className="rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            ⬇ Baixar imagem
          </button>
          {canNativeShare ? (
            <button
              onClick={nativeShare}
              disabled={!previewUrl}
              className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              Compartilhar imagem
            </button>
          ) : (
            <a
              href={networks[0].href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
            >
              WhatsApp
            </a>
          )}
        </div>

        {/* link */}
        <div className="mt-3 flex gap-2">
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

        {/* redes (compartilham o link da pagina publica) */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink/50">
            Compartilhar o link
          </p>
          <div className="flex flex-wrap gap-2">
            {networks.map((n) =>
              n.label === "Instagram" ? (
                <button
                  key={n.label}
                  onClick={nativeShare}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${n.cls}`}
                >
                  {n.label}
                </button>
              ) : (
                <a
                  key={n.label}
                  href={n.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${n.cls}`}
                >
                  {n.label}
                </a>
              )
            )}
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-teal-500/5 px-3 py-2.5 text-xs leading-relaxed text-ink/50">
          💡 Baixe a imagem para postar no feed ou story, e use o link acima na
          bio ou na figurinha de link do story para o cliente agendar.
        </p>
      </div>
    </div>
  );
}
