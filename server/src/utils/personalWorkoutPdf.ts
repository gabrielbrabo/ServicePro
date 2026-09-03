import PDFDocument from "pdfkit";

// PDF da ficha de treino (para imprimir ou enviar ao aluno). Mesma abordagem do
// serviceOrderPdf: gera um Buffer com pdfkit.

export interface WorkoutPdfExercise {
  name: string;
  sets: string;
  reps: string;
  load: string;
  rest: string;
  notes: string;
}
export interface WorkoutPdfDay {
  label: string;
  focus: string;
  exercises: WorkoutPdfExercise[];
}
export interface WorkoutPdfInput {
  establishmentName: string;
  addressLine?: string;
  phone?: string;
  dateYMD?: string;
  studentName?: string;
  workoutName: string;
  goal?: string;
  notes?: string;
  days: WorkoutPdfDay[];
  lastAssessment?: {
    date?: string;
    weight?: number;
    height?: number;
    bodyFat?: number;
    measurements?: Record<string, number>;
  };
}

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

// rotulos das circunferencias, na ordem de exibicao
const MEASURE_LABELS: [string, string][] = [
  ["neck", "Pescoço"],
  ["shoulder", "Ombro"],
  ["chest", "Peitoral"],
  ["waist", "Cintura"],
  ["abdomen", "Abdômen"],
  ["hip", "Quadril"],
  ["armRelaxed", "Braço rel."],
  ["armFlexed", "Braço contr."],
  ["forearm", "Antebraço"],
  ["thigh", "Coxa"],
  ["calf", "Panturrilha"],
];

export function generatePersonalWorkoutPdf(
  input: WorkoutPdfInput
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
        .text("FICHA DE TREINO", left, doc.y, { width, align: "center" });
      doc.font("Helvetica").fontSize(10).fillColor("#444444");
      const meta = [
        input.workoutName,
        input.dateYMD ? longDate(input.dateYMD) : "",
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
      line("Aluno", input.studentName);
      line("Objetivo", input.goal);

      const block = (titleTxt: string, value?: string) => {
        if (!value) return;
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text(titleTxt, left, doc.y, { width });
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        doc.text(value, { width, align: "justify" });
      };

      // ---- ultima avaliacao (resumo) ----
      const la = input.lastAssessment;
      if (la) {
        const bmi =
          la.weight && la.height
            ? la.weight / Math.pow(la.height / 100, 2)
            : 0;
        const summary = [
          la.weight ? `Peso ${la.weight} kg` : "",
          la.height ? `Altura ${la.height} cm` : "",
          bmi ? `IMC ${bmi.toFixed(1)}` : "",
          la.bodyFat ? `Gordura ${la.bodyFat}%` : "",
        ]
          .filter(Boolean)
          .join("  ·  ");
        const measures = (la.measurements || {}) as Record<string, number>;
        const measureStr = MEASURE_LABELS.filter(
          ([k]) => (measures[k] || 0) > 0
        )
          .map(([k, lbl]) => `${lbl} ${measures[k]}`)
          .join("  ·  ");
        if (summary || measureStr) {
          doc.moveDown(0.5);
          doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
          doc.text(
            `Última avaliação${la.date ? " — " + longDate(la.date) : ""}`,
            left,
            doc.y,
            { width }
          );
          doc.font("Helvetica").fontSize(9.5).fillColor("#333333");
          if (summary) doc.text(summary, { width });
          if (measureStr)
            doc.text("Medidas (cm): " + measureStr, { width });
        }
      }

      block("Orientações", input.notes);
      doc.moveDown(0.6);

      // ---- dias / exercicios ----
      const cSets = right - 210;
      const cReps = right - 160;
      const cLoad = right - 110;
      const cRest = right - 55;

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > doc.page.height - MARGIN) doc.addPage();
      };

      const days = (input.days || []).filter(
        (d) => d.label || (d.exercises && d.exercises.length > 0)
      );
      days.forEach((day) => {
        ensureSpace(60);
        doc.moveDown(0.4);
        const dayTitle = [day.label, day.focus].filter(Boolean).join(" — ");
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f766e");
        doc.text(dayTitle || "Treino", left, doc.y, { width });
        doc.moveDown(0.2);

        const drawRow = (
          a: string,
          b: string,
          c: string,
          d2: string,
          e: string,
          bold = false
        ) => {
          doc
            .font(bold ? "Helvetica-Bold" : "Helvetica")
            .fontSize(9.5)
            .fillColor(bold ? "#111111" : "#333333");
          const rowY = doc.y;
          doc.text(a, left, rowY, { width: cSets - left - 6 });
          const h = doc.y;
          doc.text(b, cSets, rowY, { width: 44, align: "center" });
          doc.text(c, cReps, rowY, { width: 44, align: "center" });
          doc.text(d2, cLoad, rowY, { width: 50, align: "center" });
          doc.text(e, cRest, rowY, { width: 50, align: "center" });
          doc.y = Math.max(h, rowY + 12);
        };

        drawRow("Exercício", "Séries", "Reps", "Carga", "Descanso", true);
        y = doc.y;
        doc
          .moveTo(left, y)
          .lineTo(right, y)
          .lineWidth(0.5)
          .strokeColor("#999999")
          .stroke();
        doc.moveDown(0.2);

        (day.exercises || []).forEach((ex) => {
          ensureSpace(24);
          drawRow(
            ex.name || "-",
            ex.sets || "-",
            ex.reps || "-",
            ex.load || "-",
            ex.rest || "-"
          );
          if (ex.notes) {
            doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#666666");
            doc.text(ex.notes, left + 8, doc.y, { width: cSets - left - 14 });
            doc.moveDown(0.1);
          }
        });
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
