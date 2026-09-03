import PDFDocument from "pdfkit";

// PDF do atendimento de podologia (mapa do pe + procedimentos) para imprimir
// ou entregar ao paciente. Mesma abordagem do personalWorkoutPdf.

export interface PodiatryPdfFinding {
  foot: string; // left | right
  view: string; // dorsal | plantar
  region: string;
  condition: string;
  severity: string;
  note: string;
}
export interface PodiatryPdfProcedure {
  name: string;
  region: string;
  materials: string;
  note: string;
}
export interface PodiatryPdfInput {
  establishmentName: string;
  addressLine?: string;
  phone?: string;
  dateYMD?: string;
  patientName?: string;
  mainComplaint?: string;
  diabetic?: boolean;
  findings: PodiatryPdfFinding[];
  procedures: PodiatryPdfProcedure[];
  recommendations?: string;
  notes?: string;
  nextVisitYMD?: string;
}

// rotulos (espelhados no client/src/api/podiatry.ts)
const REGION_LABELS: Record<string, string> = {
  hallux: "Hálux",
  toes: "Dedos (2º-5º)",
  nails: "Unhas",
  forefoot: "Antepé / metatarsos",
  arch: "Arco plantar",
  lateral: "Borda lateral",
  heel: "Calcanhar",
  interdigital: "Interdigital",
};
const CONDITION_LABELS: Record<string, string> = {
  calo: "Calo / calosidade",
  micose: "Micose (pele)",
  onicomicose: "Onicomicose (unha)",
  unha_encravada: "Unha encravada",
  fissura: "Fissura / rachadura",
  verruga: "Verruga plantar",
  bolha: "Bolha",
  ferida: "Ferida / úlcera",
  ressecamento: "Ressecamento",
  outro: "Outro",
};
const FOOT_LABELS: Record<string, string> = {
  left: "Pé esquerdo",
  right: "Pé direito",
};
const VIEW_LABELS: Record<string, string> = {
  dorsal: "dorso",
  plantar: "planta",
};
const regionLabel = (k: string) => REGION_LABELS[k] || k || "-";
const conditionLabel = (k: string) => CONDITION_LABELS[k] || k || "-";

const MARGIN = 56;
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

export function generatePodiatrySessionPdf(
  input: PodiatryPdfInput
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

      // ---- cabeçalho ----
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

      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#111111")
        .text("ATENDIMENTO DE PODOLOGIA", left, doc.y, {
          width,
          align: "center",
        });
      doc.font("Helvetica").fontSize(10).fillColor("#444444");
      if (input.dateYMD)
        doc.text(longDate(input.dateYMD), { width, align: "center" });
      doc.moveDown(1);

      const line = (labelTxt: string, value?: string) => {
        if (!value) return;
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
        doc.text(`${labelTxt}: `, left, doc.y, { continued: true });
        doc.font("Helvetica").fillColor("#333333").text(value, { width });
      };
      line("Paciente", input.patientName);
      line("Queixa principal", input.mainComplaint);

      if (input.diabetic) {
        doc.moveDown(0.3);
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#b45309")
          .text(
            "⚠ Paciente diabético — atenção redobrada (pé diabético).",
            left,
            doc.y,
            { width }
          );
      }

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > doc.page.height - MARGIN) doc.addPage();
      };

      const sectionTitle = (t: string) => {
        ensureSpace(40);
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f766e");
        doc.text(t, left, doc.y, { width });
        y = doc.y + 2;
        doc
          .moveTo(left, y)
          .lineTo(right, y)
          .lineWidth(0.5)
          .strokeColor("#0f766e")
          .stroke();
        doc.moveDown(0.4);
      };

      // ---- mapa do pé (achados) ----
      sectionTitle("Mapa do pé — achados");
      const findings = input.findings || [];
      if (findings.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(9.5).fillColor("#666666");
        doc.text("Nenhum achado registrado.", left, doc.y, { width });
      } else {
        // agrupa por pé + vista
        const groups: Record<string, PodiatryPdfFinding[]> = {};
        for (const f of findings) {
          const k = `${f.foot}|${f.view}`;
          (groups[k] = groups[k] || []).push(f);
        }
        Object.keys(groups).forEach((k) => {
          const [foot, view] = k.split("|");
          ensureSpace(30);
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
          doc.text(
            `${FOOT_LABELS[foot] || foot} (${VIEW_LABELS[view] || view})`,
            left,
            doc.y,
            { width }
          );
          doc.font("Helvetica").fontSize(9.5).fillColor("#333333");
          groups[k].forEach((f) => {
            ensureSpace(16);
            const sev = f.severity ? ` — ${f.severity}` : "";
            const nt = f.note ? `: ${f.note}` : "";
            doc.text(
              `•  ${regionLabel(f.region)} — ${conditionLabel(
                f.condition
              )}${sev}${nt}`,
              left + 8,
              doc.y,
              { width: width - 8 }
            );
          });
          doc.moveDown(0.2);
        });
      }

      // ---- procedimentos ----
      sectionTitle("Procedimentos realizados");
      const procs = input.procedures || [];
      if (procs.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(9.5).fillColor("#666666");
        doc.text("Nenhum procedimento registrado.", left, doc.y, { width });
      } else {
        doc.font("Helvetica").fontSize(9.5).fillColor("#333333");
        procs.forEach((p) => {
          ensureSpace(20);
          const parts = [p.name, p.region ? `(${p.region})` : ""]
            .filter(Boolean)
            .join(" ");
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
          doc.text(`•  ${parts}`, left + 4, doc.y, { width: width - 8 });
          const extra = [
            p.materials ? `Materiais: ${p.materials}` : "",
            p.note || "",
          ]
            .filter(Boolean)
            .join("  —  ");
          if (extra) {
            doc.font("Helvetica").fontSize(9).fillColor("#555555");
            doc.text(extra, left + 16, doc.y, { width: width - 20 });
          }
          doc.moveDown(0.15);
        });
      }

      const block = (t: string, v?: string) => {
        if (!v) return;
        sectionTitle(t);
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        doc.text(v, left, doc.y, { width, align: "justify" });
      };
      block("Orientações ao paciente", input.recommendations);
      block("Observações", input.notes);

      if (input.nextVisitYMD) {
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
        doc.text(
          `Próxima visita sugerida: ${longDate(input.nextVisitYMD)}`,
          left,
          doc.y,
          { width }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
