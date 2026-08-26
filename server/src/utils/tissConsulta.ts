import crypto from "crypto";

// Gera o XML da Guia de Consulta no padrao TISS (Fase 2, v1).
// IMPORTANTE: o XML deve ser validado no validador oficial da ANS antes de
// enviar a uma operadora — pequenos ajustes de campo/ordem podem ser exigidos
// pela versao/operadora. O hash e o MD5 da concatenacao dos valores (padrao TISS).

export interface ConsultaProcedure {
  tussCode: string;
  quantity: number;
  unitValue: number;
}

export interface ConsultaInput {
  registroANS: string;
  numeroGuiaPrestador: string;
  numeroCarteira: string;
  nomeBeneficiario: string;
  // prestador
  cnpj: string;
  cnes: string;
  providerCode: string;
  contractedName: string;
  tissVersion: string;
  // profissional executante
  profName: string;
  councilCode: string;
  councilNumber: string;
  councilUF: string;
  cbo: string;
  // atendimento
  dataAtendimento: Date;
  procedures: ConsultaProcedure[];
  // controle
  sequencial: string;
  numeroLote: string;
  generatedAt: Date;
}

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const hms = (d: Date) => {
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${mi}:${s}`;
};
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

// UF -> codigo IBGE (tabela 37 TISS). Aceita sigla ou o proprio codigo.
const UF_CODE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};
const ufCode = (uf: string): string => {
  const u = String(uf || "").trim().toUpperCase();
  return UF_CODE[u] || u; // se ja for codigo numerico, mantem
};

export function buildConsultaXml(input: ConsultaInput): {
  xml: string;
  hash: string;
} {
  const vals: string[] = [];
  // el(tag, value): registra o valor (p/ hash) e devolve o elemento
  const el = (tag: string, value: string | number) => {
    const v = String(value ?? "");
    vals.push(v);
    return `<ans:${tag}>${esc(v)}</ans:${tag}>`;
  };

  const total = input.procedures.reduce(
    (a, p) => a + (p.quantity || 1) * (p.unitValue || 0),
    0
  );

  // consulta = 1 procedimento (a propria consulta)
  const p0 = input.procedures[0] || { tussCode: "", quantity: 1, unitValue: 0 };
  const valorProc = (p0.quantity || 1) * (p0.unitValue || 0);
  void total;

  const body = `  <ans:cabecalho>
    <ans:identificacaoTransacao>
      ${el("tipoTransacao", "ENVIO_LOTE_GUIAS")}
      ${el("sequencialTransacao", input.sequencial)}
      ${el("dataRegistroTransacao", ymd(input.generatedAt))}
      ${el("horaRegistroTransacao", hms(input.generatedAt))}
    </ans:identificacaoTransacao>
    <ans:origem>
      <ans:identificacaoPrestador>
        ${el("CNPJ", input.cnpj)}
      </ans:identificacaoPrestador>
    </ans:origem>
    <ans:destino>
      ${el("registroANS", input.registroANS)}
    </ans:destino>
    ${el("Padrao", input.tissVersion)}
  </ans:cabecalho>
  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      ${el("numeroLote", input.numeroLote)}
      <ans:guiasTISS>
        <ans:guiaConsulta>
          <ans:cabecalhoConsulta>
            ${el("registroANS", input.registroANS)}
            ${el("numeroGuiaPrestador", input.numeroGuiaPrestador)}
          </ans:cabecalhoConsulta>
          <ans:dadosBeneficiario>
            ${el("numeroCarteira", input.numeroCarteira)}
            ${el("atendimentoRN", "N")}
            ${el("tipoIdent", "01")}
            ${el("identificadorBeneficiario", input.nomeBeneficiario)}
          </ans:dadosBeneficiario>
          <ans:contratadoExecutante>
            ${el("codigoPrestadorNaOperadora", input.providerCode)}
            ${el("CNES", input.cnes)}
          </ans:contratadoExecutante>
          <ans:profissionalExecutante>
            ${el("nomeProfissional", input.profName)}
            ${el("conselhoProfissional", input.councilCode)}
            ${el("numeroConselhoProfissional", input.councilNumber)}
            ${el("UF", ufCode(input.councilUF))}
            ${el("CBOS", input.cbo)}
          </ans:profissionalExecutante>
          ${el("indicacaoAcidente", "9")}
          <ans:dadosAtendimento>
            ${el("regimeAtendimento", "05")}
            ${el("dataAtendimento", ymd(input.dataAtendimento))}
            ${el("tipoConsulta", "1")}
            <ans:procedimento>
              ${el("codigoTabela", "22")}
              ${el("codigoProcedimento", p0.tussCode)}
              ${el("valorProcedimento", money(valorProc))}
            </ans:procedimento>
          </ans:dadosAtendimento>
        </ans:guiaConsulta>
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>`;

  // hash TISS = MD5 da concatenacao dos VALORES do XML na ordem em que
  // aparecem, PRESERVANDO os espacos internos (ex: "Maria da Silva"), sem tags
  // e sem os espacos/quebras de formatacao. `vals` ja guarda exatamente isso.
  const hash = crypto.createHash("md5").update(vals.join(""), "utf8").digest("hex");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n` +
    body +
    `\n  <ans:epilogo>\n    <ans:hash>${hash}</ans:hash>\n  </ans:epilogo>\n` +
    `</ans:mensagemTISS>\n`;

  return { xml, hash };
}
