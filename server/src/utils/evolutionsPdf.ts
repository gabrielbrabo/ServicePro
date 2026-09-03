import PDFDocument from "pdfkit";

// Relatorio (linha do tempo) das evolucoes SOAP de um paciente. Buffer pdfkit.

export interface EvoPdfItem {
  date?: string; // "YYYY-MM-DD" ou ISO
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  cids?: { code: string; description?: string }[];
}
export interface EvolutionsPdfInput {
  establishmentName: string;
  phone?: string;
  patientName?: string;
  items: EvoPdfItem[];
}

const M = 56;
const fmt = (d?: string): string => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
};

export function generateEvolutionsPdf(
  input: EvolutionsPdfInput
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: M, bottom: M, left: M, right: M },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = M;
      const right = doc.page.width - M;
      const width = right - left;

      doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111");
      doc.text(input.establishmentName || "", left, M, { width, align: "center" });
      if (input.phone) {
        doc.font("Helvetica").fontSize(9).fillColor("#444444");
        doc.text(input.phone, { width, align: "center" });
      }
      doc.moveDown(0.5);
      const y = doc.y;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).strokeColor("#111111").stroke();
      doc.moveDown(0.8);

      doc.font("Helvetica-Bold").fontSize(13).fillColor("#111111");
      doc.text("EVOLUÇÃO CLÍNICA — LINHA DO TEMPO", left, doc.y, {
        width,
        align: "center",
      });
      if (input.patientName) {
        doc.font("Helvetica").fontSize(11).fillColor("#333333");
        doc.text(`Paciente: ${input.patientName}`, { width, align: "center" });
      }
      doc.moveDown(0.8);

      const items = input.items || [];
      if (items.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor("#666666");
        doc.text("Sem evoluções registradas.", left, doc.y, { width });
      }
      items.forEach((ev, i) => {
        const cids = (ev.cids || [])
          .map((c) => (c.description ? `${c.code} ${c.description}` : c.code))
          .join(", ");
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text(`${fmt(ev.date)}`, left, doc.y, { width });
        if (cids) {
          doc.font("Helvetica").fontSize(9).fillColor("#666666");
          doc.text(`CID: ${cids}`, left, doc.y, { width });
        }
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        const soap = (k: string, v?: string) => {
          if (!v) return;
          doc.text(`${k}: ${v}`, left + 8, doc.y, { width: width - 8, align: "justify" });
        };
        soap("S", ev.subjective);
        soap("O", ev.objective);
        soap("A", ev.assessment);
        soap("P", ev.plan);
        doc.moveDown(0.4);
        if (i < items.length - 1) {
          const ly = doc.y;
          doc.moveTo(left, ly).lineTo(right, ly).lineWidth(0.5).strokeColor("#dddddd").stroke();
          doc.moveDown(0.4);
        }
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
