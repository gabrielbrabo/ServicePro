import PDFDocument from "pdfkit";

// PDF de contrato/briefing de um job de fotografia (para enviar/assinar).
// Mesma abordagem do serviceOrderPdf: gera um Buffer com pdfkit.

export interface PhotoContractInput {
  establishmentName: string;
  addressLine?: string;
  phone?: string;
  number: number;
  dateYMD?: string; // "2026-09-01"
  statusLabel: string;
  clientName?: string;
  clientPhone?: string;
  title?: string;
  eventType?: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
  briefing?: string;
  deliverables?: string;
  deliveryDeadline?: string;
  deliveryLink?: string;
  price: number;
  deposit: number;
  paymentMethodLabel?: string;
  contractTerms?: string;
  notes?: string;
}

const MARGIN = 56;
const brl = (n: number) =>
  "R$ " + (Number(n) || 0).toFixed(2).replace(".", ",");

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

export function generatePhotoContractPdf(
  input: PhotoContractInput
): Promise<Buffer> {
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

      const left = MARGIN;
      const right = doc.page.width - MARGIN;
      const width = right - left;

      // ---- cabecalho ----
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111");
      doc.text(input.establishmentName || "", left, MARGIN, {
        width,
        align: "center",
      });
      doc.font("Helvetica").fontSize(9).fillColor("#444444");
      if (input.addressLine)
        doc.text(input.addressLine, { width, align: "center" });
      if (input.phone) doc.text(input.phone, { width, align: "center" });
      doc.moveDown(0.6);
      let y = doc.y;
      doc
        .moveTo(left, y)
        .lineTo(right, y)
        .lineWidth(1.5)
        .strokeColor("#111111")
        .stroke();
      doc.moveDown(1);

      // titulo
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#111111")
        .text(`CONTRATO / BRIEFING FOTOGRÁFICO Nº ${input.number}`, left, doc.y, {
          width,
          align: "center",
        });
      doc.font("Helvetica").fontSize(10).fillColor("#444444");
      const meta = [
        input.dateYMD ? longDate(input.dateYMD) : "",
        `Status: ${input.statusLabel}`,
      ]
        .filter(Boolean)
        .join("   ·   ");
      doc.text(meta, { width, align: "center" });
      doc.moveDown(1);

      const line = (labelTxt: string, value?: string) => {
        if (!value) return;
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
        doc.text(`${labelTxt}: `, left, doc.y, { continued: true });
        doc.font("Helvetica").fillColor("#333333").text(value, { width });
      };
      if (input.title) {
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
        doc.text(input.title, left, doc.y, { width });
        doc.moveDown(0.3);
      }
      line("Cliente", input.clientName);
      line("Telefone", input.clientPhone);
      line("Tipo", input.eventType);
      const when = [input.eventDate, input.eventTime].filter(Boolean).join(" ");
      line("Data do evento", when);
      line("Local", input.location);
      line("Prazo de entrega", input.deliveryDeadline);
      line("Galeria de entrega", input.deliveryLink);
      doc.moveDown(0.6);

      const block = (titleTxt: string, value?: string) => {
        if (!value) return;
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text(titleTxt, left, doc.y, { width });
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        doc.text(value, { width, align: "justify" });
        doc.moveDown(0.5);
      };
      block("Briefing", input.briefing);
      block("Entregáveis", input.deliverables);

      // ---- valores ----
      const totLine = (labelTxt: string, value: string, bold = false) => {
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(bold ? 13 : 10)
          .fillColor("#111111");
        const rowY = doc.y;
        doc.text(labelTxt, right - 260, rowY, { width: 180, align: "right" });
        doc.text(value, right - 75, rowY, { width: 75, align: "right" });
        doc.moveDown(bold ? 0.2 : 0.15);
      };
      doc.moveDown(0.2);
      if (input.deposit > 0) {
        totLine("Sinal / entrada", brl(input.deposit));
        totLine("Saldo", brl(Math.max(0, input.price - input.deposit)));
      }
      totLine("VALOR TOTAL", brl(input.price), true);
      if (input.paymentMethodLabel) {
        doc.font("Helvetica").fontSize(9).fillColor("#444444");
        doc.text(`Forma de pagamento: ${input.paymentMethodLabel}`, left, doc.y, {
          width,
          align: "right",
        });
      }
      doc.moveDown(0.6);

      // ---- termos ----
      if (input.contractTerms) {
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
        doc.text("TERMOS DO CONTRATO", left, doc.y, { width });
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        doc.text(input.contractTerms, { width, align: "justify" });
        doc.moveDown(0.5);
      }
      block("Observações", input.notes);

      // ---- assinaturas ----
      doc.moveDown(3);
      const colW = (width - 40) / 2;
      const yLine = doc.y;
      const sign = (x: number, label: string) => {
        doc
          .moveTo(x, yLine)
          .lineTo(x + colW, yLine)
          .lineWidth(1)
          .strokeColor("#111111")
          .stroke();
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#111111")
          .text(label, x, yLine + 6, { width: colW, align: "center" });
      };
      sign(left, input.clientName || "Contratante");
      sign(left + colW + 40, input.establishmentName || "Contratada");

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
