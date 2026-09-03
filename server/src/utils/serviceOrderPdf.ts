import PDFDocument from "pdfkit";

// PDF de uma Ordem de Servico (para imprimir ou enviar ao cliente).
// Mesma abordagem dos documentos clinicos: gera um Buffer com pdfkit.

export interface OrderPdfPart {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface OrderPdfInput {
  establishmentName: string;
  addressLine?: string;
  phone?: string;
  number: number;
  dateYMD?: string; // "2026-08-27"
  statusLabel: string;
  clientName?: string;
  clientPhone?: string;
  professionalName?: string;
  object?: string;
  reportedProblem?: string;
  diagnosis?: string;
  parts: OrderPdfPart[];
  laborCost: number;
  discount: number;
  total: number;
  warrantyDays?: number;
  warrantyNote?: string;
  notes?: string;
  vehicle?: {
    plate?: string;
    brand?: string;
    model?: string;
    year?: number;
    km?: number;
    color?: string;
    nextRevisionKm?: number;
    nextRevisionDate?: string;
  };
  inspection?: { item: string; status: string; note?: string }[];
  equipment?: {
    brand?: string;
    model?: string;
    serial?: string;
    accessories?: string;
    condition?: string;
  };
  technicalReport?: string;
  pestControl?: {
    targetPest?: string;
    products?: string;
    method?: string;
    nextApplication?: string;
    technician?: string;
  };
  warranty?: {
    coverage?: string;
    exclusions?: string;
  };
  measurements?: {
    garment?: string;
    fabric?: string;
    fittingDate?: string;
    items?: { name: string; value: string }[];
    notes?: string;
  };
}

const INSPECTION_LABEL: Record<string, string> = {
  ok: "OK",
  atencao: "Atenção",
  troca: "Trocar",
  na: "—",
};

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

export function generateServiceOrderPdf(input: OrderPdfInput): Promise<Buffer> {
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
      doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).strokeColor("#111111").stroke();
      doc.moveDown(1);

      // titulo + numero + data + status
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#111111")
        .text(`ORDEM DE SERVIÇO Nº ${input.number}`, left, doc.y, {
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

      // ---- dados do cliente / objeto ----
      const line = (labelTxt: string, value?: string) => {
        if (!value) return;
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
        doc.text(`${labelTxt}: `, left, doc.y, { continued: true });
        doc.font("Helvetica").fillColor("#333333").text(value, { width });
      };
      line("Cliente", input.clientName);
      line("Telefone", input.clientPhone);
      line("Profissional", input.professionalName);
      line("Objeto", input.object);
      // veiculo (extra automotivo)
      const veh = input.vehicle;
      if (veh && (veh.plate || veh.model || veh.brand)) {
        const vehStr = [
          [veh.brand, veh.model].filter(Boolean).join(" "),
          veh.plate ? `Placa ${veh.plate}` : "",
          veh.year ? String(veh.year) : "",
          veh.km ? `${veh.km} km` : "",
          veh.color,
        ]
          .filter(Boolean)
          .join(" · ");
        line("Veículo", vehStr);
        const rev = [
          veh.nextRevisionKm ? `${veh.nextRevisionKm} km` : "",
          veh.nextRevisionDate || "",
        ]
          .filter(Boolean)
          .join(" · ");
        if (rev) line("Próxima revisão", rev);
      }
      // equipamento (extra assistencia tecnica)
      const eq = input.equipment;
      if (eq && (eq.brand || eq.model || eq.serial)) {
        const eqStr = [
          [eq.brand, eq.model].filter(Boolean).join(" "),
          eq.serial ? `Série ${eq.serial}` : "",
          eq.accessories ? `Acessórios: ${eq.accessories}` : "",
          eq.condition ? `Estado: ${eq.condition}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        line("Equipamento", eqStr);
      }
      doc.moveDown(0.6);

      const block = (titleTxt: string, value?: string) => {
        if (!value) return;
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text(titleTxt, left, doc.y, { width });
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        doc.text(value, { width, align: "justify" });
        doc.moveDown(0.5);
      };
      block("Defeito relatado", input.reportedProblem);
      block("Diagnóstico", input.diagnosis);
      block("Laudo técnico", input.technicalReport);
      // certificado de dedetizacao
      const pc = input.pestControl;
      if (pc && (pc.targetPest || pc.products || pc.nextApplication)) {
        block("Praga-alvo", pc.targetPest);
        block("Produtos utilizados", pc.products);
        block("Método", pc.method);
        block("Próxima aplicação / validade", pc.nextApplication);
        block("Responsável técnico", pc.technician);
      }

      // checklist de inspecao (extra automotivo)
      const insp = (input.inspection || []).filter((i) => i.item);
      if (insp.length > 0) {
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text("Inspeção", left, doc.y, { width });
        doc.font("Helvetica").fontSize(10).fillColor("#333333");
        insp.forEach((i) => {
          const label = INSPECTION_LABEL[i.status] || i.status;
          const note = i.note ? ` (${i.note})` : "";
          doc.text(`•  ${i.item}: ${label}${note}`, left, doc.y, { width });
        });
        doc.moveDown(0.5);
      }

      // ---- ficha de medidas (costura / ajustes) ----
      const ms = input.measurements;
      const msItems = (ms?.items || []).filter((i) => i.name || i.value);
      if (
        ms &&
        (ms.garment || ms.fabric || ms.fittingDate || ms.notes || msItems.length)
      ) {
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text("Ficha de medidas", left, doc.y, { width });
        doc.moveDown(0.2);
        line("Peça", ms.garment);
        line("Tecido", ms.fabric);
        line("Prova / entrega", ms.fittingDate);
        if (msItems.length > 0) {
          doc.font("Helvetica").fontSize(10).fillColor("#333333");
          const colW = (width - 20) / 2;
          for (let i = 0; i < msItems.length; i += 2) {
            const rowY = doc.y;
            const a = msItems[i];
            const b = msItems[i + 1];
            doc.text(`•  ${a.name}: ${a.value}`, left, rowY, { width: colW });
            const h = doc.y;
            if (b)
              doc.text(`•  ${b.name}: ${b.value}`, left + colW + 20, rowY, {
                width: colW,
              });
            doc.y = Math.max(h, doc.y);
          }
        }
        if (ms.notes) block("Observações da costura", ms.notes);
        doc.moveDown(0.4);
      }

      // ---- tabela de pecas / materiais ----
      const parts = (input.parts || []).filter(
        (p) => p.description || p.qty || p.unitPrice
      );
      if (parts.length > 0) {
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
        doc.text("Peças / materiais", left, doc.y, { width });
        doc.moveDown(0.3);

        // colunas
        const cQty = right - 210;
        const cUnit = right - 150;
        const cSub = right - 70;
        const drawRow = (
          a: string,
          b: string,
          c: string,
          d: string,
          bold = false
        ) => {
          doc
            .font(bold ? "Helvetica-Bold" : "Helvetica")
            .fontSize(10)
            .fillColor(bold ? "#111111" : "#333333");
          const rowY = doc.y;
          doc.text(a, left, rowY, { width: cQty - left - 6 });
          const h = doc.y;
          doc.text(b, cQty, rowY, { width: 50, align: "right" });
          doc.text(c, cUnit, rowY, { width: 70, align: "right" });
          doc.text(d, cSub, rowY, { width: 70, align: "right" });
          doc.y = Math.max(h, rowY + 12);
        };
        drawRow("Descrição", "Qtd", "Unit.", "Subtotal", true);
        y = doc.y;
        doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor("#999999").stroke();
        doc.moveDown(0.2);
        parts.forEach((p) => {
          const sub = (Number(p.qty) || 0) * (Number(p.unitPrice) || 0);
          drawRow(
            p.description || "-",
            String(p.qty || 0),
            brl(p.unitPrice),
            brl(sub)
          );
        });
        doc.moveDown(0.4);
      }

      // ---- totais ----
      const partsTotal = parts.reduce(
        (s, p) => s + (Number(p.qty) || 0) * (Number(p.unitPrice) || 0),
        0
      );
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
      if (partsTotal > 0) totLine("Peças / materiais", brl(partsTotal));
      if (input.laborCost > 0) totLine("Mão de obra", brl(input.laborCost));
      if (input.discount > 0) totLine("Desconto", "- " + brl(input.discount));
      doc.moveDown(0.1);
      totLine("TOTAL", brl(input.total), true);
      doc.moveDown(0.6);

      // ---- garantia / observacoes ----
      const wt = input.warranty;
      const hasTerm = !!(wt && (wt.coverage || wt.exclusions));
      const prazoStr =
        input.warrantyDays && input.warrantyDays > 0
          ? `${input.warrantyDays} dia(s)${
              input.warrantyNote ? " — " + input.warrantyNote : ""
            }`
          : "";
      if (hasTerm) {
        // termo de garantia formal (refrigeracao / eletrica-hidraulica)
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
        doc.text("TERMO DE GARANTIA", left, doc.y, { width });
        doc.moveDown(0.3);
        if (prazoStr) block("Prazo", prazoStr);
        else
          block(
            "Prazo",
            "A garantia vigora conforme prazo legal e o descrito neste termo."
          );
        block("Cobertura", wt?.coverage);
        block("Exclusões", wt?.exclusions);
        doc.font("Helvetica").fontSize(8).fillColor("#666666");
        doc.text(
          "A garantia tem início na data de entrega do serviço e cobre exclusivamente os itens descritos acima.",
          left,
          doc.y,
          { width, align: "justify" }
        );
        doc.moveDown(0.5);
      } else if (prazoStr) {
        block("Garantia", prazoStr);
      }
      block("Observações", input.notes);

      // ---- assinatura ----
      doc.moveDown(3);
      const lineW = 260;
      const lineX = left + (width - lineW) / 2;
      const lineY = doc.y;
      doc
        .moveTo(lineX, lineY)
        .lineTo(lineX + lineW, lineY)
        .lineWidth(1)
        .strokeColor("#111111")
        .stroke();
      doc.moveDown(0.4);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#111111")
        .text(input.clientName || "Assinatura do cliente", left, doc.y, {
          width,
          align: "center",
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#666666")
        .text("Ciente e de acordo com o serviço descrito.", {
          width,
          align: "center",
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
