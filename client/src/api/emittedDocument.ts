import { api } from "../lib/api";

export interface EmittedDocument {
  _id: string;
  establishment: string;
  client: string;
  issuer?: string;
  type: "atestado" | "declaracao" | "receita" | "pedido_exame" | string;
  patientName?: string;
  issuerName?: string;
  council?: string;
  summary?: string;
  signatureStatus?: "nao_assinado" | "pendente" | "assinado" | "falhou";
  signatureProvider?: string;
  signedUrl?: string;
  signedAt?: string;
  createdAt: string;
}

export interface LogDocumentInput {
  type: "atestado" | "declaracao" | "receita" | "pedido_exame";
  patientName?: string;
  issuerName?: string;
  council?: string;
  summary?: string;
}

// dados completos do documento para gerar o PDF no servidor
export interface PdfDocumentInput {
  type: "atestado" | "declaracao" | "receita" | "pedido_exame";
  establishmentName: string;
  addressLine?: string;
  phone?: string;
  patientName: string;
  issuer?: string;
  council?: string;
  city?: string;
  dateYMD?: string;
  days?: string | number;
  cid?: string;
  startTime?: string;
  endTime?: string;
  receitaType?: "comum" | "controle_especial" | "azul" | "amarela";
  meds?: { name: string; instructions?: string }[];
  exams?: string[];
  examIndication?: string;
}

const base = "/documents";

export const documentApi = {
  // historico de um paciente
  listByPatient: (establishmentId: string, clientId: string) =>
    api
      .get<EmittedDocument[]>(`${base}/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  // registra uma emissao (auditoria)
  log: (establishmentId: string, clientId: string, data: LogDocumentInput) =>
    api
      .post<EmittedDocument>(`${base}/${establishmentId}/${clientId}`, data)
      .then((r) => r.data),

  // gera o PDF do documento no servidor (retorna o arquivo)
  pdf: (establishmentId: string, clientId: string, data: PdfDocumentInput) =>
    api
      .post<Blob>(`${base}/${establishmentId}/${clientId}/pdf`, data, {
        responseType: "blob",
      })
      .then((r) => r.data),

  // consulta o status da assinatura no provedor e atualiza (sem webhook)
  refreshSignature: (
    establishmentId: string,
    clientId: string,
    docId: string
  ) =>
    api
      .get<EmittedDocument>(
        `${base}/${establishmentId}/${clientId}/${docId}/refresh-signature`
      )
      .then((r) => r.data),

  // URL fresca do PDF assinado (gerada na hora; o link expira em minutos)
  signedPdf: (establishmentId: string, clientId: string, docId: string) =>
    api
      .get<{ url: string }>(
        `${base}/${establishmentId}/${clientId}/${docId}/signed-pdf`
      )
      .then((r) => r.data),

  // envia o documento para assinatura digital (ICP-Brasil via Clicksign)
  sign: (
    establishmentId: string,
    clientId: string,
    data: PdfDocumentInput & {
      signerName?: string;
      signerEmail: string;
      summary?: string;
    }
  ) =>
    api
      .post<EmittedDocument>(
        `${base}/${establishmentId}/${clientId}/sign`,
        data
      )
      .then((r) => r.data),

  // auditoria de todo o estabelecimento (opcional; para uma tela futura)
  listByEstablishment: (
    establishmentId: string,
    opts?: { type?: string; limit?: number }
  ) =>
    api
      .get<EmittedDocument[]>(`${base}/${establishmentId}`, { params: opts })
      .then((r) => r.data),
};