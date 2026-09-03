import PDFDocument from "pdfkit";

// Relatorio da ficha clinica (linha do tempo do paciente): queixa, avaliacao e
// evolucoes por sessao (SOAP + CID). Buffer via pdfkit.

export interface ClinicalPdfSession {
  date?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  cid?: string;
}
export interface ClinicalPdfInput {
  establishmentName: string;
  phone?: string;
  patientName?: string;
  patientPhone?: string;
  complaint?: string;
  history?: string;
  nextReturn?: string;
  notes?: string;
  sessions: ClinicalPdfSession[];
}

const M = 56;

export function generateClinicalRecordPdf(
  input: ClinicalPdfInput
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
      doc.moveDown(0.6);
      const y = doc.y;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).strokeColor("#111111").stroke();
      doc.moveDown(1);

      doc.font("Helvetica-Bold").fontSize(14).fillColor("#111111");
      doc.text("FICHA CLÍNICA", left, doc.y, { width, align: "center" });
      doc.moveDown(0.8);

      const line = (l: string, v?: string) => {
        if (!v) return;
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
        doc.text(`${l}: `, left, doc.y, { continued: true });
        doc.font("Helvetica").fillColor("#333333").text(v, { width });
      };
      line("Paciente", input.patientName);
      line("Telefone", input.patientPhone);
      line("Queixa principal", input.complaint);
      line("Retorno previsto", input.nextReturn);
      doc.moveDown(0.4);

      const block = (t: string, v?: string) => {
        if (!v) return;
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text(t, left, doc.y, { width });
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        doc.text(v, { width, align: "justify" });
        doc.moveDown(0.4);
      };
      block("Avaliação inicial / histórico", input.history);

      const sessions = (input.sessions || []).filter(
        (s) => s.date || s.subjective || s.objective || s.assessment || s.plan
      );
      if (sessions.length > 0) {
        doc.moveDown(0.2);
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
        doc.text("Evoluções (linha do tempo)", left, doc.y, { width });
        doc.moveDown(0.3);
        sessions.forEach((s, i) => {
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
          const head = [`Sessão ${i + 1}`, s.date, s.cid ? `CID ${s.cid}` : ""]
            .filter(Boolean)
            .join("  ·  ");
          doc.text(head, left, doc.y, { width });
          doc.font("Helvetica").fontSize(10).fillColor("#333333");
          const soap = (k: string, v?: string) => {
            if (!v) return;
            doc.text(`${k}: ${v}`, left + 8, doc.y, { width: width - 8 });
          };
          soap("S", s.subjective);
          soap("O", s.objective);
          soap("A", s.assessment);
          soap("P", s.plan);
          doc.moveDown(0.4);
        });
      }
      block("Observações", input.notes);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
