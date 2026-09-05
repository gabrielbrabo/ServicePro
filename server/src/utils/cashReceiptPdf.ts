import PDFDocument from "pdfkit";

// Recibo de venda do caixa (para imprimir ou enviar ao cliente).
// Mesma abordagem dos demais PDFs: gera um Buffer com pdfkit.

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptPayment {
  method: "dinheiro" | "cartao" | "pix" | "outro";
  amount: number;
}

export interface ReceiptInput {
  establishmentName: string;
  addressLine?: string;
  phone?: string;
  date: Date;
  clientName?: string;
  professionalName?: string;
  items: ReceiptItem[];
  discount: number;
  fee: number;
  total: number;
  payments: ReceiptPayment[];
  receivable: boolean;
  paid: boolean;
  description?: string;
}

const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "Pix",
  outro: "Outro",
};

const MARGIN = 48;
const brl = (n: number) =>
  "R$ " + (Number(n) || 0).toFixed(2).replace(".", ",");

const fmtDateTime = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
};

export function generateCashReceiptPdf(input: ReceiptInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // recibo estreito (~80mm) estilo cupom
      const doc = new PDFDocument({
        size: [300, 720],
        margins: { top: MARGIN, bottom: MARGIN, left: 24, right: 24 },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = 24;
      const right = doc.page.width - 24;
      const width = right - left;

      // cabecalho
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#111111");
      doc.text(input.establishmentName || "", left, MARGIN, {
        width,
        align: "center",
      });
      doc.font("Helvetica").fontSize(8).fillColor("#444444");
      if (input.addressLine)
        doc.text(input.addressLine, { width, align: "center" });
      if (input.phone) doc.text(input.phone, { width, align: "center" });
      doc.moveDown(0.5);

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
      doc.text("RECIBO", { width, align: "center" });
      doc.font("Helvetica").fontSize(8).fillColor("#444444");
      doc.text(fmtDateTime(input.date), { width, align: "center" });

      let y = doc.y + 6;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor("#999999").dash(2, { space: 2 }).stroke();
      doc.undash();
      doc.moveDown(0.6);

      if (input.clientName) {
        doc.font("Helvetica").fontSize(9).fillColor("#333333");
        doc.text(`Cliente: ${input.clientName}`, left, doc.y, { width });
      }
      if (input.professionalName) {
        doc.font("Helvetica").fontSize(9).fillColor("#333333");
        doc.text(`Profissional: ${input.professionalName}`, left, doc.y, {
          width,
        });
      }
      doc.moveDown(0.4);

      // itens
      const cTot = right - 70;
      const drawRow = (a: string, b: string, bold = false) => {
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(9)
          .fillColor("#111111");
        const rowY = doc.y;
        doc.text(a, left, rowY, { width: cTot - left - 6 });
        const h = doc.y;
        doc.text(b, cTot, rowY, { width: 70, align: "right" });
        doc.y = Math.max(h, rowY + 11);
      };

      const items = (input.items || []).filter((i) => i.name || i.total);
      if (items.length > 0) {
        items.forEach((it) => {
          const label =
            it.qty > 1 ? `${it.qty}x ${it.name}` : it.name || "Item";
          drawRow(label, brl(it.total));
        });
      } else if (input.description) {
        drawRow(input.description, brl(input.total));
      }

      doc.moveDown(0.2);
      y = doc.y;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor("#999999").dash(2, { space: 2 }).stroke();
      doc.undash();
      doc.moveDown(0.4);

      if (input.discount > 0) drawRow("Desconto", "- " + brl(input.discount));
      drawRow("TOTAL", brl(input.total), true);
      if (input.fee > 0) {
        doc.font("Helvetica").fontSize(8).fillColor("#666666");
        doc.text(`(taxa de cartão: ${brl(input.fee)})`, left, doc.y, {
          width,
        });
      }
      doc.moveDown(0.4);

      // pagamento
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
      doc.text("Pagamento", left, doc.y, { width });
      doc.font("Helvetica").fontSize(9).fillColor("#333333");
      if (input.receivable && !input.paid) {
        doc.text("A prazo (fiado) — em aberto", left, doc.y, { width });
      } else {
        (input.payments || []).forEach((p) => {
          drawRow(METHOD_LABEL[p.method] || p.method, brl(p.amount));
        });
      }

      doc.moveDown(1.2);
      doc.font("Helvetica").fontSize(7.5).fillColor("#888888");
      doc.text(
        "Documento sem valor fiscal. Gerado por ServicePro.",
        left,
        doc.y,
        { width, align: "center" }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
