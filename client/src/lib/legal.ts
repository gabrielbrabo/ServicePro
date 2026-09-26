// Dados legais do ServiçosPro usados nos Termos de Uso e na Politica de
// Privacidade (empresa responsavel pela plataforma).
//
// IMPORTANTE: ao alterar o TEXTO dos termos/politica, troque LEGAL_VERSION
// aqui E no back (server/src/config/legal.ts). Todos os usuarios verao o
// pedido de aceite da nova versao no proximo acesso.

export const LEGAL_VERSION = "2026-09-26";
export const LEGAL_UPDATED_LABEL = "26 de setembro de 2026";

export const COMPANY = {
  brand: "ServiçosPro",
  site: "servicospro.com",
  legalName: "GADZ TECNOLOGIA DA INFORMAÇÃO LTDA",
  cnpj: "61.263.961/0001-83",
  address: "Rua dos Oliveira, 1373, Centro, São Romão/MG",
  contactEmail: "tecnologiagadz@gmail.com",
  // Encarregado pelo tratamento de dados pessoais (DPO) — LGPD art. 41
  dpoName: "GADZ Tecnologia da Informação LTDA",
  dpoEmail: "tecnologiagadz@gmail.com",
  // foro para resolver disputas (normalmente a comarca da sede da empresa)
  forum: "São Romão/MG",
};

// um bloco de texto: string = paragrafo; string[] = lista com marcadores
export type LegalBlock = string | string[];
export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}
