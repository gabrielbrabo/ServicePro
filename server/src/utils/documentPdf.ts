import PDFDocument from "pdfkit";

// Geracao dos documentos clinicos (atestado, declaracao, receita, pedido de
// exame) como PDF de verdade no servidor. Espelha o conteudo que o
// PatientDocuments.tsx montava so para impressao. Serve tanto para "baixar PDF"
// quanto de base para a assinatura digital (o provedor assina este PDF).

export type DocType = "atestado" | "declaracao" | "receita" | "pedido_exame";
export type ReceitaType = "comum" | "controle_especial" | "azul" | "amarela";

export interface DocMed {
  name: string;
  instructions?: string;
}

export interface DocPdfInput {
  type: DocType;
  // cabecalho do estabelecimento
  establishmentName: string;
  addressLine?: string;
  phone?: string;
  // emissor / local / data
  patientName: string;
  issuer?: string;
  council?: string;
  city?: string;
  dateYMD?: string; // "2026-08-18"
  // atestado
  days?: string | number;
  cid?: string;
  // declaracao
  startTime?: string;
  endTime?: string;
  // receita
  receitaType?: ReceitaType;
  meds?: DocMed[];
  // pedido de exame
  exams?: string[];
  examIndication?: string;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function longDate(ymd?: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

const RECEITA_TITLE: Record<ReceitaType, string> = {
  comum: "RECEITUÁRIO",
  controle_especial: "RECEITUÁRIO DE CONTROLE ESPECIAL",
  azul: "RECEITA DE CONTROLE ESPECIAL (B)",
  amarela: "RECEITA (A)",
};

// nome amigavel do documento (para o Clicksign / nome do arquivo)
export function documentTitle(input: DocPdfInput): string {
  if (input.type === "atestado") return "Atestado";
  if (input.type === "declaracao") return "Declaração de comparecimento";
  if (input.type === "pedido_exame") return "Solicitação de exames";
  return RECEITA_TITLE[input.receitaType || "comum"];
}

const MARGIN = 56;

// paleta do documento (identidade visual)
const INK = "#0f1b1a";
const MUTED = "#6b7280";
const ACCENT = "#0E7C72";
const ACCENT_DK = "#084A44";
const HAIRLINE = "#e5e7eb";

// faixa de cor no topo da pagina
function drawTopBand(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 10).fill(ACCENT);
  doc.rect(0, 10, doc.page.width, 2).fill(ACCENT_DK);
  doc.restore();
}

// monograma (inicial do estabelecimento) num circulo teal, centralizado
function drawMonogram(doc: PDFKit.PDFDocument, name: string) {
  const cx = doc.page.width / 2;
  const cy = MARGIN + 14;
  const r = 15;
  doc.save();
  doc.circle(cx, cy, r).fill(ACCENT);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(initial, cx - r, cy - 7, { width: r * 2, align: "center" });
  doc.restore();
}

// desenha cabecalho (estabelecimento) + titulo; retorna nada (usa cursor)
function drawHeader(doc: PDFKit.PDFDocument, input: DocPdfInput, title: string) {
  const left = MARGIN;
  const right = doc.page.width - MARGIN;
  const width = right - left;

  drawMonogram(doc, input.establishmentName || "");

  doc.font("Helvetica-Bold").fontSize(17).fillColor(INK);
  doc.text(input.establishmentName || "", left, MARGIN + 38, {
    width,
    align: "center",
  });
  const contacts = [input.addressLine, input.phone].filter(Boolean).join("   ·   ");
  if (contacts) {
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED);
    doc.text(contacts, { width, align: "center" });
  }
  doc.moveDown(0.9);

  const y = doc.y;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).strokeColor(ACCENT).stroke();
  doc
    .moveTo(left, y + 3)
    .lineTo(right, y + 3)
    .lineWidth(0.5)
    .strokeColor(HAIRLINE)
    .stroke();
  doc.moveDown(1.8);

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(INK)
    .text(title.toUpperCase(), left, doc.y, {
      width,
      align: "center",
      characterSpacing: 1.5,
    });
  // sublinhado de destaque sob o titulo
  const uy = doc.y + 4;
  const uw = 54;
  const ux = left + (width - uw) / 2;
  doc.moveTo(ux, uy).lineTo(ux + uw, uy).lineWidth(2.5).strokeColor(ACCENT).stroke();
  doc.moveDown(1.8);
}

// desenha rodape com local/data + linha de assinatura
function drawSignature(doc: PDFKit.PDFDocument, input: DocPdfInput) {
  const left = MARGIN;
  const right = doc.page.width - MARGIN;
  const width = right - left;

  doc.moveDown(3);
  const dateTxt = `${input.city ? input.city + ", " : ""}${longDate(
    input.dateYMD
  )}.`;
  doc
    .font("Helvetica")
    .fontSize(11.5)
    .fillColor(INK)
    .text(dateTxt.trim(), left, doc.y, { width, align: "center" });

  doc.moveDown(3.4);
  // linha de assinatura centralizada (240pt)
  const lineW = 240;
  const lineX = left + (width - lineW) / 2;
  const lineY = doc.y;
  doc
    .moveTo(lineX, lineY)
    .lineTo(lineX + lineW, lineY)
    .strokeColor(INK)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.45);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(INK)
    .text(input.issuer || "Profissional", left, doc.y, {
      width,
      align: "center",
    });
  if (input.council && input.council.trim()) {
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(input.council.trim(), { width, align: "center" });
  }
}

// rodape de marca fixado no rodape da pagina
function drawFooter(doc: PDFKit.PDFDocument, input: DocPdfInput) {
  const left = MARGIN;
  const right = doc.page.width - MARGIN;
  const width = right - left;
  const y = doc.page.height - MARGIN + 12;
  doc.save();
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(HAIRLINE).stroke();
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      `Documento emitido por ${input.establishmentName || ""}  ·  ServiçosPro`,
      left,
      y + 5,
      { width, align: "center" }
    );
  doc.restore();
}

function bodyText(input: DocPdfInput): string {
  const p = input.patientName;
  if (input.type === "atestado") {
    const cidTxt = input.cid && input.cid.trim() ? ` (CID ${input.cid.trim()})` : "";
    const days = String(input.days || "1");
    return `Atesto para os devidos fins que o(a) paciente ${p} esteve sob atendimento neste estabelecimento, necessitando de afastamento de suas atividades pelo período de ${days} dia(s)${cidTxt}, a partir de ${longDate(
      input.dateYMD
    )}.`;
  }
  const horario =
    input.startTime && input.endTime
      ? `, no horário das ${input.startTime} às ${input.endTime}`
      : "";
  return `Declaro para os devidos fins que o(a) Sr(a). ${p} compareceu a atendimento neste estabelecimento no dia ${longDate(
    input.dateYMD
  )}${horario}.`;
}

// desenha o corpo de acordo com o tipo (assume cabecalho ja desenhado)
function drawBody(doc: PDFKit.PDFDocument, input: DocPdfInput) {
  const left = MARGIN;
  const width = doc.page.width - MARGIN * 2;

  if (input.type === "atestado" || input.type === "declaracao") {
    doc
      .font("Helvetica")
      .fontSize(12.5)
      .fillColor(INK)
      .text(bodyText(input), left, doc.y, {
        width,
        align: "justify",
        lineGap: 5,
      });
    return;
  }

  if (input.type === "receita") {
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(INK)
      .text(`Paciente: ${input.patientName}`, left, doc.y, { width });
    doc.moveDown(0.8);
    const meds = (input.meds || []).filter((m) => m.name && m.name.trim());
    meds.forEach((m, i) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(INK)
        .text(`${i + 1}. ${m.name.trim()}`, left, doc.y, { width });
      if (m.instructions && m.instructions.trim()) {
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor(MUTED)
          .text(m.instructions.trim(), left + 16, doc.y, { width: width - 16 });
      }
      doc.moveDown(0.5);
    });
    return;
  }

  // pedido de exame
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(INK)
    .text(`Paciente: ${input.patientName}`, left, doc.y, { width });
  doc.moveDown(0.8);
  const exams = (input.exams || []).map((e) => e.trim()).filter(Boolean);
  exams.forEach((e, i) => {
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(INK)
      .text(`${i + 1}. ${e}`, left, doc.y, { width });
    doc.moveDown(0.2);
  });
  if (input.examIndication && input.examIndication.trim()) {
    doc.moveDown(0.8);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(INK)
      .text("Indicação clínica: ", left, doc.y, { continued: true });
    doc.font("Helvetica").text(input.examIndication.trim());
  }
}

// desenha uma "folha" completa (cabecalho + corpo + assinatura), com rotulo de
// via opcional (para receitas de controle especial, 2 vias)
function drawSheet(
  doc: PDFKit.PDFDocument,
  input: DocPdfInput,
  title: string,
  viaLabel?: string
) {
  drawTopBand(doc);
  if (viaLabel) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(viaLabel.toUpperCase(), MARGIN, MARGIN - 26, {
        width: doc.page.width - MARGIN * 2,
        align: "right",
        characterSpacing: 0.5,
      });
  }
  drawHeader(doc, input, title);
  drawBody(doc, input);
  drawSignature(doc, input);
  drawFooter(doc, input);
}

export function generateDocumentPdf(input: DocPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const title = documentTitle(input);
      const controlled =
        input.type === "receita" &&
        (input.receitaType || "comum") !== "comum";

      if (controlled) {
        drawSheet(doc, input, title, "1ª via — Farmácia");
        doc.addPage();
        drawSheet(doc, input, title, "2ª via — Paciente");
      } else {
        drawSheet(doc, input, title);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
