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

// desenha cabecalho (estabelecimento) + titulo; retorna nada (usa cursor)
function drawHeader(doc: PDFKit.PDFDocument, input: DocPdfInput, title: string) {
  const left = MARGIN;
  const right = doc.page.width - MARGIN;

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111");
  doc.text(input.establishmentName || "", left, MARGIN, {
    width: right - left,
    align: "center",
  });
  doc.font("Helvetica").fontSize(9).fillColor("#444444");
  if (input.addressLine) {
    doc.text(input.addressLine, { width: right - left, align: "center" });
  }
  if (input.phone) {
    doc.text(input.phone, { width: right - left, align: "center" });
  }
  doc.moveDown(0.6);
  const y = doc.y;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#111111").lineWidth(1.5).stroke();
  doc.moveDown(1.4);

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#111111")
    .text(title, { width: right - left, align: "center", characterSpacing: 1 });
  doc.moveDown(1.2);
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
    .fontSize(12)
    .fillColor("#111111")
    .text(dateTxt.trim(), left, doc.y, { width, align: "center" });

  doc.moveDown(3.5);
  // linha de assinatura centralizada (240pt)
  const lineW = 240;
  const lineX = left + (width - lineW) / 2;
  const lineY = doc.y;
  doc
    .moveTo(lineX, lineY)
    .lineTo(lineX + lineW, lineY)
    .strokeColor("#111111")
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.4);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111111")
    .text(input.issuer || "Profissional", left, doc.y, {
      width,
      align: "center",
    });
  if (input.council && input.council.trim()) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#444444")
      .text(input.council.trim(), { width, align: "center" });
  }
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
      .fontSize(12)
      .fillColor("#111111")
      .text(bodyText(input), left, doc.y, { width, align: "justify" });
    return;
  }

  if (input.type === "receita") {
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#111111")
      .text(`Paciente: ${input.patientName}`, left, doc.y, { width });
    doc.moveDown(0.8);
    const meds = (input.meds || []).filter((m) => m.name && m.name.trim());
    meds.forEach((m, i) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#111111")
        .text(`${i + 1}. ${m.name.trim()}`, left, doc.y, { width });
      if (m.instructions && m.instructions.trim()) {
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor("#333333")
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
    .fillColor("#111111")
    .text(`Paciente: ${input.patientName}`, left, doc.y, { width });
  doc.moveDown(0.8);
  const exams = (input.exams || []).map((e) => e.trim()).filter(Boolean);
  exams.forEach((e, i) => {
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#111111")
      .text(`${i + 1}. ${e}`, left, doc.y, { width });
    doc.moveDown(0.2);
  });
  if (input.examIndication && input.examIndication.trim()) {
    doc.moveDown(0.8);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111111")
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
  if (viaLabel) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#555555")
      .text(viaLabel, MARGIN, MARGIN - 24, {
        width: doc.page.width - MARGIN * 2,
        align: "right",
      });
  }
  drawHeader(doc, input, title);
  drawBody(doc, input);
  drawSignature(doc, input);
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
