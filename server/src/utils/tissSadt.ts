import crypto from "crypto";

// Gera o XML da Guia SP/SADT no padrao TISS 04.03.00 (Fase 2).
// Estrutura mais complexa que a consulta: solicitante + executante + varios
// procedimentos. Reaproveita o algoritmo de hash e o mapa de UF da consulta.
// Validar sempre no validador oficial antes de enviar.

export interface SadtProcedure {
  tussCode: string;
  description?: string;
  quantity: number;
  unitValue: number;
}

export interface SadtInput {
  registroANS: string;
  numeroGuiaPrestador: string;
  numeroCarteira: string;
  nomeBeneficiario: string;
  cnpj: string;
  tissVersion: string;
  // solicitante (na clinica que se auto-solicita = mesmo do executante)
  solicCode: string;
  solicName: string;
  solicProfName: string;
  solicConselho: string;
  solicNumero: string;
  solicUF: string;
  solicCBO: string;
  // executante
  execCode: string;
  execCNES: string;
  // atendimento
  dataSolicitacao: Date;
  procedures: SadtProcedure[];
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

const UF_CODE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};
const ufCode = (uf: string): string => {
  const u = String(uf || "").trim().toUpperCase();
  return UF_CODE[u] || u;
};

export function buildSadtXml(input: SadtInput): { xml: string; hash: string } {
  const vals: string[] = [];
  const el = (tag: string, value: string | number) => {
    const v = String(value ?? "");
    vals.push(v);
    return `<ans:${tag}>${esc(v)}</ans:${tag}>`;
  };

  const total = input.procedures.reduce(
    (a, p) => a + (p.quantity || 1) * (p.unitValue || 0),
    0
  );

  // procedimento inline (a funcao roda DENTRO do template, na ordem do
  // documento — importante para o hash bater).
  const procItem = (p: SadtProcedure, i: number) => {
    const vTot = (p.quantity || 1) * (p.unitValue || 0);
    return `
          <ans:procedimentoExecutado>
            ${el("sequencialItem", String(i + 1))}
            ${el("dataExecucao", ymd(input.dataSolicitacao))}
            <ans:procedimento>
              ${el("codigoTabela", "22")}
              ${el("codigoProcedimento", p.tussCode)}
              ${el("descricaoProcedimento", p.description || p.tussCode)}
            </ans:procedimento>
            ${el("quantidadeExecutada", String(p.quantity || 1))}
            ${el("reducaoAcrescimo", "1.00")}
            ${el("valorUnitario", money(p.unitValue || 0))}
            ${el("valorTotal", money(vTot))}
          </ans:procedimentoExecutado>`;
  };

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
        <ans:guiaSP-SADT>
          <ans:cabecalhoGuia>
            ${el("registroANS", input.registroANS)}
            ${el("numeroGuiaPrestador", input.numeroGuiaPrestador)}
          </ans:cabecalhoGuia>
          <ans:dadosBeneficiario>
            ${el("numeroCarteira", input.numeroCarteira)}
            ${el("atendimentoRN", "N")}
            ${el("tipoIdent", "01")}
            ${el("identificadorBeneficiario", input.nomeBeneficiario)}
          </ans:dadosBeneficiario>
          <ans:dadosSolicitante>
            <ans:contratadoSolicitante>
              ${el("codigoPrestadorNaOperadora", input.solicCode)}
            </ans:contratadoSolicitante>
            ${el("nomeContratadoSolicitante", input.solicName)}
            <ans:profissionalSolicitante>
              ${el("nomeProfissional", input.solicProfName)}
              ${el("conselhoProfissional", input.solicConselho)}
              ${el("numeroConselhoProfissional", input.solicNumero)}
              ${el("UF", ufCode(input.solicUF))}
              ${el("CBOS", input.solicCBO)}
            </ans:profissionalSolicitante>
          </ans:dadosSolicitante>
          <ans:dadosSolicitacao>
            ${el("dataSolicitacao", ymd(input.dataSolicitacao))}
            ${el("caraterAtendimento", "1")}
          </ans:dadosSolicitacao>
          <ans:dadosExecutante>
            <ans:contratadoExecutante>
              ${el("codigoPrestadorNaOperadora", input.execCode)}
            </ans:contratadoExecutante>
            ${el("CNES", input.execCNES)}
          </ans:dadosExecutante>
          <ans:dadosAtendimento>
            ${el("tipoAtendimento", "04")}
            ${el("indicacaoAcidente", "9")}
            ${el("regimeAtendimento", "05")}
          </ans:dadosAtendimento>
          <ans:procedimentosExecutados>${input.procedures
            .map((p, i) => procItem(p, i))
            .join("")}
          </ans:procedimentosExecutados>
          <ans:valorTotal>
            ${el("valorProcedimentos", money(total))}
            ${el("valorTotalGeral", money(total))}
          </ans:valorTotal>
        </ans:guiaSP-SADT>
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>`;

  const hash = crypto.createHash("md5").update(vals.join(""), "utf8").digest("hex");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n` +
    body +
    `\n  <ans:epilogo>\n    <ans:hash>${hash}</ans:hash>\n  </ans:epilogo>\n` +
    `</ans:mensagemTISS>\n`;

  return { xml, hash };
}
