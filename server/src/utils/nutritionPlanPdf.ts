import PDFDocument from "pdfkit";

// PDF do plano alimentar (para imprimir ou enviar ao paciente). Mesma abordagem
// do personalWorkoutPdf: gera um Buffer com pdfkit.

export interface PlanPdfItem {
  food: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
}
export interface PlanPdfMeal {
  label: string;
  time: string;
  notes: string;
  items: PlanPdfItem[];
}
export interface PlanPdfInput {
  establishmentName: string;
  addressLine?: string;
  phone?: string;
  dateYMD?: string;
  patientName?: string;
  planName: string;
  goal?: string;
  notes?: string;
  meals: PlanPdfMeal[];
  targets?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    water?: number;
  };
  lastAssessment?: {
    date?: string;
    weight?: number;
    height?: number;
    bodyFat?: number;
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

export function generateNutritionPlanPdf(
  input: PlanPdfInput
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

      // título
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#111111")
        .text("PLANO ALIMENTAR", left, doc.y, { width, align: "center" });
      doc.font("Helvetica").fontSize(10).fillColor("#444444");
      const meta = [
        input.planName,
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
      line("Paciente", input.patientName);
      line("Objetivo", input.goal);

      // ---- metas do dia ----
      const t = input.targets;
      if (t) {
        const parts = [
          t.calories ? `${t.calories} kcal` : "",
          t.protein ? `Proteína ${t.protein} g` : "",
          t.carbs ? `Carbo ${t.carbs} g` : "",
          t.fat ? `Gordura ${t.fat} g` : "",
          t.water ? `Água ${(t.water / 1000).toFixed(t.water % 1000 ? 1 : 0)} L` : "",
        ].filter(Boolean);
        if (parts.length) {
          doc.moveDown(0.4);
          doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
          doc.text("Metas diárias", left, doc.y, { width });
          doc.font("Helvetica").fontSize(9.5).fillColor("#333333");
          doc.text(parts.join("   ·   "), { width });
        }
      }

      // ---- última avaliação (resumo) ----
      const la = input.lastAssessment;
      if (la && (la.weight || la.height || la.bodyFat)) {
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
        doc.moveDown(0.4);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text(
          `Última avaliação${la.date ? " — " + longDate(la.date) : ""}`,
          left,
          doc.y,
          { width }
        );
        doc.font("Helvetica").fontSize(9.5).fillColor("#333333");
        doc.text(summary, { width });
      }

      if (input.notes) {
        doc.moveDown(0.4);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text("Orientações gerais", left, doc.y, { width });
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        doc.text(input.notes, { width, align: "justify" });
      }
      doc.moveDown(0.6);

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > doc.page.height - MARGIN) doc.addPage();
      };

      // totais do dia
      let dayKcal = 0;
      let dayP = 0;
      let dayC = 0;
      let dayF = 0;

      const meals = (input.meals || []).filter(
        (m) => m.label || (m.items && m.items.length > 0)
      );
      meals.forEach((meal) => {
        ensureSpace(70);
        doc.moveDown(0.4);
        const mealTitle = [meal.label || "Refeição", meal.time]
          .filter(Boolean)
          .join("  ·  ");
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f766e");
        doc.text(mealTitle, left, doc.y, { width });
        doc.moveDown(0.2);

        let mealKcal = 0;
        (meal.items || []).forEach((it) => {
          ensureSpace(20);
          mealKcal += it.calories || 0;
          dayKcal += it.calories || 0;
          dayP += it.protein || 0;
          dayC += it.carbs || 0;
          dayF += it.fat || 0;

          const rowY = doc.y;
          // alimento + quantidade
          const nameTxt = [it.food || "-", it.amount ? `(${it.amount})` : ""]
            .filter(Boolean)
            .join(" ");
          doc.font("Helvetica").fontSize(10).fillColor("#222222");
          doc.text(`•  ${nameTxt}`, left + 4, rowY, { width: width - 120 });
          const afterName = doc.y;
          // kcal à direita
          if (it.calories) {
            doc
              .font("Helvetica")
              .fontSize(9.5)
              .fillColor("#666666")
              .text(`${it.calories} kcal`, right - 110, rowY, {
                width: 110,
                align: "right",
              });
          }
          doc.y = Math.max(afterName, rowY + 12);
          // macros / observação
          const macros = [
            it.protein ? `P ${it.protein}g` : "",
            it.carbs ? `C ${it.carbs}g` : "",
            it.fat ? `G ${it.fat}g` : "",
          ]
            .filter(Boolean)
            .join("  ");
          const sub = [macros, it.notes].filter(Boolean).join("  —  ");
          if (sub) {
            doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#888888");
            doc.text(sub, left + 16, doc.y, { width: width - 20 });
            doc.moveDown(0.1);
          }
        });

        if (meal.notes) {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#666666");
          doc.text(meal.notes, left + 4, doc.y, { width: width - 8 });
        }
        if (mealKcal) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f766e");
          doc.text(`Subtotal: ${mealKcal} kcal`, left + 4, doc.y, {
            width: width - 8,
          });
        }
      });

      // ---- total do dia ----
      if (dayKcal || dayP || dayC || dayF) {
        ensureSpace(40);
        doc.moveDown(0.6);
        y = doc.y;
        doc
          .moveTo(left, y)
          .lineTo(right, y)
          .lineWidth(1)
          .strokeColor("#111111")
          .stroke();
        doc.moveDown(0.4);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        const total = [
          dayKcal ? `${dayKcal} kcal` : "",
          dayP ? `Proteína ${Math.round(dayP)} g` : "",
          dayC ? `Carbo ${Math.round(dayC)} g` : "",
          dayF ? `Gordura ${Math.round(dayF)} g` : "",
        ]
          .filter(Boolean)
          .join("   ·   ");
        doc.text(`Total do dia:  ${total}`, left, doc.y, { width });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
