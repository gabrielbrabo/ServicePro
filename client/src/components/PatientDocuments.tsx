import { useEffect, useState } from "react";
import { Establishment } from "../api/establishment";
import { useAuth } from "../context/AuthContext";
import { documentApi, EmittedDocument } from "../api/emittedDocument";

// Assinatura digital (ICP-Brasil / Clicksign) temporariamente DESATIVADA.
// Para religar a funcionalidade depois, basta trocar para true.
const SIGNATURE_ENABLED: boolean = false;

type DocType = "atestado" | "declaracao" | "receita" | "pedido_exame";
type ReceitaType = "comum" | "controle_especial" | "azul" | "amarela";

interface MedItem {
  name: string; // medicamento + concentracao
  instructions: string; // posologia / orientacao
}

const DOC_LABEL: Record<string, string> = {
  atestado: "Atestado",
  declaracao: "Declaração de comparecimento",
  receita: "Receituário",
  pedido_exame: "Pedido de exame",
};

// titulo impresso de cada tipo de receita
const RECEITA_LABEL: Record<ReceitaType, string> = {
  comum: "RECEITUÁRIO",
  controle_especial: "RECEITUÁRIO DE CONTROLE ESPECIAL",
  azul: "RECEITA DE CONTROLE ESPECIAL (B)",
  amarela: "RECEITA (A)",
};

const RECEITA_SHORT: Record<ReceitaType, string> = {
  comum: "Comum (branca)",
  controle_especial: "Controle especial",
  azul: "B (azul)",
  amarela: "A (amarela)",
};

// data local YYYY-MM-DD
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "18 de agosto de 2026"
function longDate(ymd: string) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// monta "CRO-SP 12345" a partir do registro salvo no perfil do profissional
function formatCouncil(u?: {
  councilType?: string;
  councilState?: string;
  councilNumber?: string;
} | null): string {
  if (!u) return "";
  const t = (u.councilType || "").trim();
  const s = (u.councilState || "").trim();
  const n = (u.councilNumber || "").trim();
  if (!t && !n) return "";
  const head = s ? `${t}-${s}` : t;
  return [head, n].filter(Boolean).join(" ");
}

// abre uma janela de impressao com o HTML pronto (usuario salva como PDF)
function openPrint(html: string) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    alert("Permita pop-ups neste site para gerar o documento.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function PatientDocuments({
  establishment,
  patientName,
  patientId,
}: {
  establishment: Establishment;
  patientName: string;
  patientId: string;
}) {
  const { user } = useAuth();

  const [history, setHistory] = useState<EmittedDocument[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signMsg, setSignMsg] = useState<string | null>(null);
  // e-mail de quem vai assinar (recebe o link do Clicksign)
  const [signerEmail, setSignerEmail] = useState(user?.email || "");

  // carrega o historico de documentos emitidos para este paciente
  useEffect(() => {
    setLoadingHistory(true);
    documentApi
      .listByPatient(establishment._id, patientId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [establishment._id, patientId]);

  const [type, setType] = useState<DocType>("atestado");
  const [issuer, setIssuer] = useState(user?.name || "");
  // pre-preenche o registro a partir do perfil do profissional logado
  const [council, setCouncil] = useState(formatCouncil(user)); // CRM / CRO / CREFITO...
  const [city, setCity] = useState(establishment.address?.city || "");
  const [date, setDate] = useState(toYMD(new Date()));

  // atestado
  const [days, setDays] = useState("1");
  const [cid, setCid] = useState("");
  // declaracao
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // receita (prescricao estruturada)
  const [receitaType, setReceitaType] = useState<ReceitaType>("comum");
  const [meds, setMeds] = useState<MedItem[]>([{ name: "", instructions: "" }]);
  // pedido de exame
  const [exams, setExams] = useState<string[]>([""]);
  const [examIndication, setExamIndication] = useState("");

  const isControlled = receitaType !== "comum";

  const addr = establishment.address;
  const addrLine = addr
    ? [addr.street, addr.number, addr.neighborhood, addr.city, addr.state]
        .filter(Boolean)
        .join(", ")
    : "";

  // ---- edicao das listas ----
  const updateMed = (i: number, field: keyof MedItem, val: string) =>
    setMeds((list) =>
      list.map((m, idx) => (idx === i ? { ...m, [field]: val } : m))
    );
  const addMed = () =>
    setMeds((list) => [...list, { name: "", instructions: "" }]);
  const removeMed = (i: number) =>
    setMeds((list) =>
      list.length === 1
        ? [{ name: "", instructions: "" }]
        : list.filter((_, idx) => idx !== i)
    );

  const updateExam = (i: number, val: string) =>
    setExams((list) => list.map((e, idx) => (idx === i ? val : e)));
  const addExam = () => setExams((list) => [...list, ""]);
  const removeExam = (i: number) =>
    setExams((list) =>
      list.length === 1 ? [""] : list.filter((_, idx) => idx !== i)
    );

  const filledMeds = meds.filter((m) => m.name.trim());
  const filledExams = exams.map((e) => e.trim()).filter(Boolean);

  const canGenerate =
    type === "receita"
      ? filledMeds.length > 0
      : type === "pedido_exame"
      ? filledExams.length > 0
      : true;

  // ---- geracao do documento ----

  // cabecalho + rodape (assinatura) comuns a todos os documentos
  const sheet = (content: string, viaLabel?: string, brk?: boolean): string => `
    <div class="sheet${brk ? " brk" : ""}">
      ${viaLabel ? `<div class="via">${esc(viaLabel)}</div>` : ""}
      <div class="head">
        <div class="est">${esc(establishment.name)}</div>
        ${addrLine ? `<div class="addr">${esc(addrLine)}</div>` : ""}
        ${
          establishment.phone
            ? `<div class="addr">${esc(establishment.phone)}</div>`
            : ""
        }
      </div>
      ${content}
      <div class="foot">
        <div>${esc(city)}, ${longDate(date)}.</div>
        <div class="sig"><div class="line">
          <div><b>${esc(issuer || "Profissional")}</b></div>
          ${
            council.trim()
              ? `<div class="council">${esc(council.trim())}</div>`
              : ""
          }
        </div></div>
      </div>
    </div>`;

  // corpo de atestado / declaracao (texto corrido)
  const textBody = (): { title: string; body: string } => {
    const p = `<b>${esc(patientName)}</b>`;
    if (type === "atestado") {
      const cidTxt = cid.trim() ? ` (CID ${esc(cid.trim())})` : "";
      return {
        title: "ATESTADO",
        body: `Atesto para os devidos fins que o(a) paciente ${p} esteve sob atendimento
          neste estabelecimento, necessitando de afastamento de suas atividades pelo
          período de <b>${esc(days || "1")} dia(s)</b>${cidTxt}, a partir de ${longDate(
          date
        )}.`,
      };
    }
    const horario =
      startTime && endTime
        ? `, no horário das ${esc(startTime)} às ${esc(endTime)}`
        : "";
    return {
      title: "DECLARAÇÃO DE COMPARECIMENTO",
      body: `Declaro para os devidos fins que o(a) Sr(a). ${p} compareceu a atendimento
        neste estabelecimento no dia ${longDate(date)}${horario}.`,
    };
  };

  // corpo da receita (prescricao)
  const receitaContent = (): string => {
    const items = filledMeds
      .map(
        (m, i) => `<li>
          <div class="mname">${i + 1}. ${esc(m.name.trim())}</div>
          ${
            m.instructions.trim()
              ? `<div class="mposo">${esc(m.instructions.trim())}</div>`
              : ""
          }
        </li>`
      )
      .join("");
    return `<h1>${RECEITA_LABEL[receitaType]}</h1>
      <div class="pac">Paciente: <b>${esc(patientName)}</b></div>
      <ol class="meds">${items}</ol>`;
  };

  // corpo do pedido de exame
  const examContent = (): string => {
    const items = filledExams
      .map((e, i) => `<li>${i + 1}. ${esc(e)}</li>`)
      .join("");
    return `<h1>SOLICITAÇÃO DE EXAMES</h1>
      <div class="pac">Paciente: <b>${esc(patientName)}</b></div>
      <ol class="exams">${items}</ol>
      ${
        examIndication.trim()
          ? `<div class="ind"><b>Indicação clínica:</b> ${esc(
              examIndication.trim()
            )}</div>`
          : ""
      }`;
  };

  const fullHtml = (docTitle: string, sheets: string): string =>
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
      <title>${docTitle}</title>
      <style>
        @page { size: A4; margin: 20mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13pt; line-height: 1.6; }
        .sheet { padding-bottom: 8px; }
        .brk { page-break-before: always; }
        .via { text-align: right; font-size: 10pt; color:#555; margin-bottom: 6px; }
        .head { text-align:center; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:22px; }
        .est { font-size: 16pt; font-weight: 700; }
        .addr { font-size: 10pt; color:#444; margin-top:2px; }
        h1 { font-size: 15pt; text-align:center; letter-spacing:1px; margin: 22px 0; }
        .body { text-align: justify; }
        .pac { margin: 6px 0 16px; }
        .meds { padding-left: 0; list-style: none; min-height: 160px; }
        .meds li { margin-bottom: 12px; }
        .mname { font-weight: 700; }
        .mposo { font-size: 11pt; color:#333; margin-left: 16px; }
        .exams { padding-left: 0; list-style: none; min-height: 120px; }
        .exams li { margin-bottom: 8px; }
        .ind { margin-top: 14px; font-size: 12pt; }
        .foot { margin-top: 48px; text-align:center; }
        .sig { margin-top: 56px; }
        .line { width: 320px; margin: 0 auto; border-top:1px solid #111; padding-top:6px; }
        .council { font-size: 10pt; color:#444; }
      </style></head><body>${sheets}</body></html>`;

  const generate = () => {
    if (!canGenerate) return;
    let docTitle = "";
    let sheets = "";

    if (type === "atestado" || type === "declaracao") {
      const { title, body } = textBody();
      docTitle = title;
      sheets = sheet(`<h1>${title}</h1><div class="body">${body}</div>`);
    } else if (type === "receita") {
      docTitle = RECEITA_LABEL[receitaType];
      const content = receitaContent();
      // controlados saem em 2 vias (farmacia + paciente)
      sheets = isControlled
        ? sheet(content, "1ª via — Farmácia") +
          sheet(content, "2ª via — Paciente", true)
        : sheet(content);
    } else {
      docTitle = "Solicitação de Exames";
      sheets = sheet(examContent());
    }

    openPrint(fullHtml(docTitle, sheets));
    logEmission();
  };

  // dados enviados ao servidor para gerar o PDF de verdade
  const pdfPayload = () => ({
    type,
    establishmentName: establishment.name,
    addressLine: addrLine || undefined,
    phone: establishment.phone || undefined,
    patientName,
    issuer: issuer.trim() || undefined,
    council: council.trim() || undefined,
    city: city.trim() || undefined,
    dateYMD: date,
    days,
    cid: cid.trim() || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    receitaType,
    meds: filledMeds,
    exams: filledExams,
    examIndication: examIndication.trim() || undefined,
  });

  // baixa o PDF gerado no servidor
  const downloadPdf = async () => {
    if (!canGenerate) return;
    setDownloading(true);
    try {
      const blob = await documentApi.pdf(
        establishment._id,
        patientId,
        pdfPayload()
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${DOC_LABEL[type] || "documento"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      logEmission();
    } catch {
      alert("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  };

  // envia o documento para assinatura digital (ICP-Brasil via Clicksign)
  const signDoc = async () => {
    if (!canGenerate) return;
    const email = signerEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSignMsg("Informe um e-mail válido de quem vai assinar o documento.");
      return;
    }
    setSigning(true);
    setSignMsg(null);
    try {
      const doc = await documentApi.sign(establishment._id, patientId, {
        ...pdfPayload(),
        signerName: issuer.trim() || user?.name || "Profissional",
        signerEmail: email,
        summary: buildSummary(),
      });
      setHistory((h) => [doc, ...h]);
      setSignMsg(
        `Enviado para assinatura. ${email} vai receber um e-mail do Clicksign para assinar com o certificado ICP-Brasil.`
      );
    } catch {
      setSignMsg(
        "Não foi possível enviar para assinatura. Verifique se a assinatura digital está configurada no servidor (.env)."
      );
    } finally {
      setSigning(false);
    }
  };

  // resumo curto por tipo, para o historico
  const buildSummary = (): string => {
    if (type === "atestado") {
      const cidTxt = cid.trim() ? ` · CID ${cid.trim()}` : "";
      return `${days || "1"} dia(s)${cidTxt}`;
    }
    if (type === "declaracao") {
      const h = startTime && endTime ? ` · ${startTime}–${endTime}` : "";
      return `${longDate(date)}${h}`;
    }
    if (type === "receita") {
      return `${RECEITA_SHORT[receitaType]} · ${filledMeds.length} item(ns)`;
    }
    return `${filledExams.length} exame(s)`;
  };

  // registra a emissao (auditoria). Falha silenciosa: nao atrapalha a impressao.
  const logEmission = () => {
    documentApi
      .log(establishment._id, patientId, {
        type,
        patientName,
        issuerName: issuer.trim() || undefined,
        council: council.trim() || undefined,
        summary: buildSummary(),
      })
      .then((doc) => setHistory((h) => [doc, ...h]))
      .catch(() => {
        /* nao bloqueia a geracao do documento */
      });
  };

  // pergunta ao provedor se o documento ja foi assinado e atualiza o histórico
  const refreshSig = async (docId: string) => {
    try {
      const updated = await documentApi.refreshSignature(
        establishment._id,
        patientId,
        docId
      );
      setHistory((h) => h.map((x) => (x._id === updated._id ? updated : x)));
    } catch {
      /* silencioso */
    }
  };

  // enquanto houver documento "pendente", consulta o status a cada 5s ate
  // virar "assinado" (para de sozinho quando nao ha mais pendentes).
  const pendingKey = history
    .filter((d) => d.signatureStatus === "pendente")
    .map((d) => d._id)
    .join(",");
  useEffect(() => {
    if (!pendingKey) return;
    const ids = pendingKey.split(",");
    // consulta um por vez, espacado, para nao estourar o limite (429) do Clicksign
    let i = 0;
    const timer = setInterval(() => {
      if (ids.length === 0) return;
      refreshSig(ids[i % ids.length]);
      i++;
    }, 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  // abre o PDF assinado buscando um link fresco na hora (o link do Clicksign expira)
  const openSignedPdf = async (docId: string) => {
    try {
      const { url } = await documentApi.signedPdf(
        establishment._id,
        patientId,
        docId
      );
      if (url) window.open(url, "_blank", "noopener");
      else alert("O PDF assinado ainda não está disponível. Tente em instantes.");
    } catch {
      alert("Não foi possível abrir o PDF assinado.");
    }
  };

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const inputCls =
    "h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h3 className="font-display font-bold text-ink">Documentos</h3>
      <p className="mt-0.5 text-sm text-ink/50">
        Gere e imprima (ou salve em PDF) documentos já preenchidos.
      </p>

      {/* tipo de documento */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["atestado", "Atestado"],
            ["declaracao", "Declaração de comparecimento"],
            ["receita", "Receituário"],
            ["pedido_exame", "Pedido de exame"],
          ] as [DocType, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${type === k
              ? "border-teal-500 bg-teal-500 text-white"
              : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* campos comuns */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Paciente
          </span>
          <input value={patientName} disabled className={`${inputCls} opacity-70`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Profissional
          </span>
          <input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Registro (CRM / CRO / CREFITO...)
          </span>
          <input
            value={council}
            onChange={(e) => setCouncil(e.target.value)}
            placeholder="Opcional"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Cidade
          </span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Data
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {/* campos por tipo */}
      {type === "atestado" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">
              Dias de afastamento
            </span>
            <input
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">
              CID (opcional)
            </span>
            <input
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
      )}

      {type === "declaracao" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">
              Horário de entrada (opcional)
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">
              Horário de saída (opcional)
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
      )}

      {/* Receita: tipo + medicamentos estruturados */}
      {type === "receita" && (
        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Tipo de receita
          </span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "comum",
                "controle_especial",
                "azul",
                "amarela",
              ] as ReceitaType[]
            ).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setReceitaType(rt)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${receitaType === rt
                  ? "border-teal-500 bg-teal-500 text-white"
                  : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                  }`}
              >
                {RECEITA_SHORT[rt]}
              </button>
            ))}
          </div>

          {isControlled && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Receitas de controle especial são impressas em 2 vias (farmácia e
              paciente). As notificações oficiais A (amarela) e B (azul) exigem
              os formulários numerados da vigilância sanitária — este documento
              não substitui esses formulários.
            </p>
          )}

          <div className="mt-3 space-y-2">
            {meds.map((m, i) => (
              <div
                key={i}
                className="rounded-xl border border-ink/10 bg-sand/30 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink/50">
                    Medicamento {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMed(i)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </div>
                <input
                  value={m.name}
                  onChange={(e) => updateMed(i, "name", e.target.value)}
                  placeholder="Medicamento e concentração (ex: Amoxicilina 500mg)"
                  className={`${inputCls} mt-2`}
                />
                <input
                  value={m.instructions}
                  onChange={(e) =>
                    updateMed(i, "instructions", e.target.value)
                  }
                  placeholder="Posologia / orientação (ex: 1 comprimido de 8/8h por 7 dias)"
                  className={`${inputCls} mt-2`}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMed}
            className="mt-2 text-sm font-semibold text-teal-600 hover:underline"
          >
            + Adicionar medicamento
          </button>
        </div>
      )}

      {/* Pedido de exame */}
      {type === "pedido_exame" && (
        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            Exames solicitados
          </span>
          <div className="space-y-2">
            {exams.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={e}
                  onChange={(ev) => updateExam(i, ev.target.value)}
                  placeholder={`Exame ${i + 1} (ex: Hemograma completo)`}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => removeExam(i)}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                  aria-label="Remover exame"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addExam}
            className="mt-2 text-sm font-semibold text-teal-600 hover:underline"
          >
            + Adicionar exame
          </button>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-ink/60">
              Indicação clínica (opcional)
            </span>
            <textarea
              value={examIndication}
              onChange={(e) => setExamIndication(e.target.value)}
              rows={2}
              placeholder="Hipótese diagnóstica, CID, motivo do exame..."
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
        </div>
      )}

      {SIGNATURE_ENABLED && (
        <label className="mt-5 block max-w-sm">
          <span className="mb-1 block text-xs font-medium text-ink/60">
            E-mail de quem vai assinar (assinatura digital)
          </span>
          <input
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            placeholder="profissional@exemplo.com"
            className={inputCls}
          />
        </label>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={downloadPdf}
          disabled={!canGenerate || downloading}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
        >
          {downloading ? "Gerando..." : "Baixar PDF"}
        </button>
        <button
          onClick={generate}
          disabled={!canGenerate}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 px-6 font-semibold text-ink/70 transition hover:bg-sand disabled:opacity-50"
        >
          Imprimir
        </button>
        {SIGNATURE_ENABLED && (
          <button
            onClick={signDoc}
            disabled={!canGenerate || signing}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-teal-500/40 bg-teal-500/10 px-6 font-semibold text-teal-700 transition hover:bg-teal-500/20 disabled:opacity-50"
          >
            {signing ? "Enviando..." : "Assinar digitalmente"}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink/40">
        "Baixar PDF" gera o arquivo no servidor. "Imprimir" abre a janela de
        impressão.
        {SIGNATURE_ENABLED &&
          ' "Assinar digitalmente" envia o documento para assinatura ICP-Brasil (o profissional recebe um e-mail para assinar).'}
      </p>
      {SIGNATURE_ENABLED && signMsg && (
        <p className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800">
          {signMsg}
        </p>
      )}

      {/* Historico de documentos emitidos (auditoria) */}
      <div className="mt-6 border-t border-ink/10 pt-5">
        <h4 className="font-display font-bold text-ink">Documentos emitidos</h4>
        <p className="mt-0.5 text-sm text-ink/50">
          Registro do que já foi gerado para este paciente.
        </p>

        <div className="mt-3">
          {loadingHistory ? (
            <div className="flex items-center gap-2 py-4 text-sm text-ink/50">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
              Carregando histórico...
            </div>
          ) : history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
              Nenhum documento emitido ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((d) => (
                <div
                  key={d._id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-ink/10 bg-sand/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {DOC_LABEL[d.type] || d.type}
                      {d.summary ? (
                        <span className="font-normal text-ink/50">
                          {" "}
                          · {d.summary}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {d.issuerName || "Profissional"}
                      {d.council ? ` · ${d.council}` : ""}
                    </p>
                    {d.signatureStatus &&
                      d.signatureStatus !== "nao_assinado" && (
                        <p className="mt-1 text-xs">
                          {d.signatureStatus === "assinado" ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                                ✓ Assinado
                              </span>
                              <button
                                onClick={() => openSignedPdf(d._id)}
                                className="font-medium text-teal-600 hover:underline"
                              >
                                ver PDF assinado
                              </button>
                            </span>
                          ) : d.signatureStatus === "pendente" ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                                Aguardando assinatura
                              </span>
                              <button
                                onClick={() => refreshSig(d._id)}
                                className="font-medium text-teal-600 hover:underline"
                              >
                                Atualizar status
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
                              Falha na assinatura
                            </span>
                          )}
                        </p>
                      )}
                  </div>
                  <span className="shrink-0 text-xs text-ink/40">
                    {fmtDateTime(d.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
