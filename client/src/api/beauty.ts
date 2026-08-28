import { api } from "../lib/api";

// Ficha tecnica do cliente (area Beleza). Espelha o padrao do prontuario da
// saude, com campos proprios da beleza.
export interface BeautyRecord {
  _id?: string;
  establishment: string;
  client: string;
  hairType: string;
  scalpSkin: string;
  allergies: string;
  sensitivities: string;
  chemicalHistory: string;
  observations: string;
  _isNew?: boolean;
}

// Registro de formula quimica aplicada num cliente.
export interface BeautyFormula {
  _id: string;
  establishment: string;
  client: string;
  date: string;
  category: string;
  service: string | { _id: string; title: string } | null;
  brand: string;
  formula: string;
  oxidant: string;
  timeMinutes: number;
  result: string;
  author: string | { _id: string; name: string };
  createdAt: string;
}

// Registro antes & depois de um cliente (privado).
export interface BeautyBeforeAfter {
  _id: string;
  establishment: string;
  client: string;
  beforeUrl: string;
  afterUrl: string;
  note: string;
  service: string | { _id: string; title: string } | null;
  date: string;
  author: string | { _id: string; name: string };
  createdAt: string;
}

// Pacote de sessoes pre-pagas de um cliente (mesmo model usado pela fisio).
export interface SessionUse {
  _id: string;
  date: string;
  by: string;
  note?: string;
}

export type PackageStatus = "ativo" | "concluido" | "cancelado";

export interface SessionPackage {
  _id: string;
  establishment: string;
  client: string;
  title: string;
  totalSessions: number;
  uses: SessionUse[];
  price: number;
  notes: string;
  status: PackageStatus;
  createdAt: string;
  updatedAt: string;
}

// ---- Fidelidade ----
export interface LoyaltyProgram {
  _id?: string;
  establishment: string;
  goal: number;
  reward: string;
  active: boolean;
  _isNew?: boolean;
}

export type LoyaltyAction = "carimbo" | "estorno" | "resgate";

export interface LoyaltyEntry {
  _id: string;
  action: LoyaltyAction;
  date: string;
  by: string;
}

export interface LoyaltyCard {
  _id?: string;
  establishment: string;
  client: string;
  stamps: number;
  rewardsGiven: number;
  history: LoyaltyEntry[];
  _isNew?: boolean;
}

// ---- Consentimento ----
export type ConsentKind = "procedimento" | "imagem" | "outro";

export interface ConsentTerm {
  _id: string;
  establishment: string;
  client: string;
  kind: ConsentKind;
  title: string;
  content: string;
  signedName: string;
  signedAt: string | null;
  attachmentUrl: string;
  author: string | { _id: string; name: string };
  createdAt: string;
}

// ---- Tatuagem (extra da categoria tatuagem) ----
export type TattooStatus = "orcamento" | "em_andamento" | "concluido";

export interface TattooSession {
  _id: string;
  date: string;
  note: string;
  healing: string;
  by: string;
}

export interface BeautyTattoo {
  _id: string;
  establishment: string;
  client: string;
  title: string;
  bodyRegion: string;
  size: string;
  style: string;
  referenceUrl: string;
  sessionsPlanned: number;
  sessions: TattooSession[];
  status: TattooStatus;
  quotePrice: number;
  depositPaid: number;
  aftercare: string;
  notes: string;
  author: string | { _id: string; name: string };
  createdAt: string;
}

// Declaracao de saude para tatuagem (por cliente).
export interface TattooHealth {
  _id?: string;
  establishment: string;
  client: string;
  conditions: string[];
  allergies: string;
  medications: string;
  pregnant: boolean;
  other: string;
  signedName: string;
  signedAt: string | null;
  _isNew?: boolean;
}

// ---- Estetica (extra da categoria estetica) ----
export interface AestheticAssessment {
  _id?: string;
  establishment: string;
  client: string;
  fitzpatrick: number; // 0 = nao avaliado, 1..6
  skinType: string;
  mainComplaint: string;
  goals: string;
  contraindications: string;
  observations: string;
  _isNew?: boolean;
}

export type AestheticArea = "face" | "corpo";

export interface AestheticApplication {
  _id: string;
  establishment: string;
  client: string;
  area: AestheticArea;
  region: string;
  procedure: string;
  product: string;
  amount: string;
  date: string;
  note: string;
  author: string | { _id: string; name: string };
  createdAt: string;
}

// ---- Sobrancelha & cílios (extra da categoria) ----
export interface LashMapZone {
  zone: string;
  length: string;
}

export interface BrowLashProfile {
  _id?: string;
  establishment: string;
  client: string;
  faceShape: string;
  browFormat: string;
  browTechnique: string;
  browColor: string;
  browMeasures: string;
  browNotes: string;
  lashTechnique: string;
  lashCurvature: string;
  lashThickness: string;
  lashGlue: string;
  lashMap: LashMapZone[];
  lashNotes: string;
  _isNew?: boolean;
}

// ---- Esterilizacao (extra da categoria manicure-pedicure; do estabelecimento) ----
export type SterilizationIndicator = "aprovado" | "reprovado" | "na";

export interface SterilizationCycle {
  _id: string;
  establishment: string;
  date: string;
  equipment: string;
  load: string;
  cycle: string;
  indicator: SterilizationIndicator;
  responsible: string;
  notes: string;
  author: string | { _id: string; name: string };
  createdAt: string;
}

// ---- Massagem (extra da categoria massagem) ----
export interface MassageAssessment {
  _id?: string;
  establishment: string;
  client: string;
  mainComplaint: string;
  tensionPoints: string;
  contraindications: string;
  goals: string;
  observations: string;
  _isNew?: boolean;
}

export interface MassageSession {
  _id: string;
  establishment: string;
  client: string;
  date: string;
  technique: string;
  regions: string;
  evolution: string;
  painBefore: number | null;
  painAfter: number | null;
  author: string | { _id: string; name: string };
  createdAt: string;
}

export const beautyApi = {
  // ---- ficha tecnica ----
  getRecord: (establishmentId: string, clientId: string) =>
    api
      .get<BeautyRecord>(`/beauty-records/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  updateRecord: (
    establishmentId: string,
    clientId: string,
    data: {
      hairType?: string;
      scalpSkin?: string;
      allergies?: string;
      sensitivities?: string;
      chemicalHistory?: string;
      observations?: string;
    }
  ) =>
    api
      .put<BeautyRecord>(`/beauty-records/${establishmentId}/${clientId}`, data)
      .then((r) => r.data),

  // ---- formulas ----
  listFormulas: (establishmentId: string, clientId: string) =>
    api
      .get<BeautyFormula[]>(`/beauty-formulas/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  addFormula: (
    establishmentId: string,
    clientId: string,
    data: {
      date?: string;
      category?: string;
      serviceId?: string | null;
      brand?: string;
      formula: string;
      oxidant?: string;
      timeMinutes?: number;
      result?: string;
    }
  ) =>
    api
      .post<BeautyFormula>(
        `/beauty-formulas/${establishmentId}/${clientId}`,
        data
      )
      .then((r) => r.data),

  removeFormula: (
    establishmentId: string,
    clientId: string,
    formulaId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `/beauty-formulas/${establishmentId}/${clientId}/${formulaId}`
      )
      .then((r) => r.data),

  // ---- antes & depois ----
  listBeforeAfter: (establishmentId: string, clientId: string) =>
    api
      .get<BeautyBeforeAfter[]>(
        `/beauty-before-after/${establishmentId}/${clientId}`
      )
      .then((r) => r.data),

  addBeforeAfter: (
    establishmentId: string,
    clientId: string,
    data: {
      beforeUrl?: string;
      afterUrl?: string;
      note?: string;
      serviceId?: string | null;
      date?: string;
    }
  ) =>
    api
      .post<BeautyBeforeAfter>(
        `/beauty-before-after/${establishmentId}/${clientId}`,
        data
      )
      .then((r) => r.data),

  removeBeforeAfter: (
    establishmentId: string,
    clientId: string,
    itemId: string
  ) =>
    api
      .delete<{
        message: string;
        _id: string;
        beforeUrl: string;
        afterUrl: string;
      }>(`/beauty-before-after/${establishmentId}/${clientId}/${itemId}`)
      .then((r) => r.data),

  // ---- pacotes de sessoes ----
  listPackages: (establishmentId: string, clientId: string) =>
    api
      .get<SessionPackage[]>(`/beauty-packages/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  createPackage: (
    establishmentId: string,
    clientId: string,
    data: {
      title?: string;
      totalSessions: number;
      price?: number;
      notes?: string;
    }
  ) =>
    api
      .post<SessionPackage>(
        `/beauty-packages/${establishmentId}/${clientId}`,
        data
      )
      .then((r) => r.data),

  updatePackage: (
    establishmentId: string,
    clientId: string,
    packageId: string,
    data: {
      title?: string;
      totalSessions?: number;
      price?: number;
      notes?: string;
      status?: PackageStatus;
    }
  ) =>
    api
      .patch<SessionPackage>(
        `/beauty-packages/${establishmentId}/${clientId}/${packageId}`,
        data
      )
      .then((r) => r.data),

  addPackageUse: (
    establishmentId: string,
    clientId: string,
    packageId: string,
    data?: { date?: string; note?: string }
  ) =>
    api
      .post<SessionPackage>(
        `/beauty-packages/${establishmentId}/${clientId}/${packageId}/uses`,
        data || {}
      )
      .then((r) => r.data),

  removePackageUse: (
    establishmentId: string,
    clientId: string,
    packageId: string,
    useId: string
  ) =>
    api
      .delete<SessionPackage>(
        `/beauty-packages/${establishmentId}/${clientId}/${packageId}/uses/${useId}`
      )
      .then((r) => r.data),

  removePackage: (
    establishmentId: string,
    clientId: string,
    packageId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `/beauty-packages/${establishmentId}/${clientId}/${packageId}`
      )
      .then((r) => r.data),

  // ---- fidelidade ----
  getProgram: (establishmentId: string) =>
    api
      .get<LoyaltyProgram>(`/loyalty/program/${establishmentId}`)
      .then((r) => r.data),

  setProgram: (
    establishmentId: string,
    data: { goal?: number; reward?: string; active?: boolean }
  ) =>
    api
      .put<LoyaltyProgram>(`/loyalty/program/${establishmentId}`, data)
      .then((r) => r.data),

  getCard: (establishmentId: string, clientId: string) =>
    api
      .get<LoyaltyCard>(`/loyalty/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  addStamp: (establishmentId: string, clientId: string) =>
    api
      .post<LoyaltyCard>(`/loyalty/${establishmentId}/${clientId}/stamp`, {})
      .then((r) => r.data),

  removeStamp: (establishmentId: string, clientId: string) =>
    api
      .delete<LoyaltyCard>(`/loyalty/${establishmentId}/${clientId}/stamp`)
      .then((r) => r.data),

  redeemReward: (establishmentId: string, clientId: string) =>
    api
      .post<LoyaltyCard>(`/loyalty/${establishmentId}/${clientId}/redeem`, {})
      .then((r) => r.data),

  // ---- consentimento ----
  listConsents: (establishmentId: string, clientId: string) =>
    api
      .get<ConsentTerm[]>(`/consents/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  createConsent: (
    establishmentId: string,
    clientId: string,
    data: {
      kind?: ConsentKind;
      title: string;
      content?: string;
      signedName?: string;
      signed?: boolean;
      attachmentUrl?: string;
    }
  ) =>
    api
      .post<ConsentTerm>(`/consents/${establishmentId}/${clientId}`, data)
      .then((r) => r.data),

  signConsent: (
    establishmentId: string,
    clientId: string,
    termId: string,
    data: { signed: boolean; signedName?: string }
  ) =>
    api
      .patch<ConsentTerm>(
        `/consents/${establishmentId}/${clientId}/${termId}`,
        data
      )
      .then((r) => r.data),

  removeConsent: (
    establishmentId: string,
    clientId: string,
    termId: string
  ) =>
    api
      .delete<{ message: string; _id: string; attachmentUrl: string }>(
        `/consents/${establishmentId}/${clientId}/${termId}`
      )
      .then((r) => r.data),

  // ---- tatuagem ----
  listTattoos: (establishmentId: string, clientId: string) =>
    api
      .get<BeautyTattoo[]>(`/beauty-tattoo/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  createTattoo: (
    establishmentId: string,
    clientId: string,
    data: {
      title: string;
      bodyRegion?: string;
      size?: string;
      style?: string;
      referenceUrl?: string;
      sessionsPlanned?: number;
      status?: TattooStatus;
      quotePrice?: number;
      depositPaid?: number;
      aftercare?: string;
      notes?: string;
    }
  ) =>
    api
      .post<BeautyTattoo>(`/beauty-tattoo/${establishmentId}/${clientId}`, data)
      .then((r) => r.data),

  updateTattoo: (
    establishmentId: string,
    clientId: string,
    pieceId: string,
    data: {
      title?: string;
      bodyRegion?: string;
      size?: string;
      style?: string;
      referenceUrl?: string;
      sessionsPlanned?: number;
      status?: TattooStatus;
      quotePrice?: number;
      depositPaid?: number;
      aftercare?: string;
      notes?: string;
    }
  ) =>
    api
      .patch<BeautyTattoo>(
        `/beauty-tattoo/${establishmentId}/${clientId}/${pieceId}`,
        data
      )
      .then((r) => r.data),

  addTattooSession: (
    establishmentId: string,
    clientId: string,
    pieceId: string,
    data?: { date?: string; note?: string; healing?: string }
  ) =>
    api
      .post<BeautyTattoo>(
        `/beauty-tattoo/${establishmentId}/${clientId}/${pieceId}/sessions`,
        data || {}
      )
      .then((r) => r.data),

  removeTattooSession: (
    establishmentId: string,
    clientId: string,
    pieceId: string,
    sessionId: string
  ) =>
    api
      .delete<BeautyTattoo>(
        `/beauty-tattoo/${establishmentId}/${clientId}/${pieceId}/sessions/${sessionId}`
      )
      .then((r) => r.data),

  removeTattoo: (establishmentId: string, clientId: string, pieceId: string) =>
    api
      .delete<{ message: string; _id: string; referenceUrl: string }>(
        `/beauty-tattoo/${establishmentId}/${clientId}/${pieceId}`
      )
      .then((r) => r.data),

  // ---- tatuagem: declaracao de saude ----
  getTattooHealth: (establishmentId: string, clientId: string) =>
    api
      .get<TattooHealth>(`/beauty-tattoo/${establishmentId}/${clientId}/health`)
      .then((r) => r.data),

  updateTattooHealth: (
    establishmentId: string,
    clientId: string,
    data: {
      conditions?: string[];
      allergies?: string;
      medications?: string;
      pregnant?: boolean;
      other?: string;
      signedName?: string;
      signed?: boolean;
    }
  ) =>
    api
      .put<TattooHealth>(
        `/beauty-tattoo/${establishmentId}/${clientId}/health`,
        data
      )
      .then((r) => r.data),

  // ---- estetica: avaliacao ----
  getAssessment: (establishmentId: string, clientId: string) =>
    api
      .get<AestheticAssessment>(
        `/beauty-aesthetic/${establishmentId}/${clientId}/assessment`
      )
      .then((r) => r.data),

  updateAssessment: (
    establishmentId: string,
    clientId: string,
    data: {
      fitzpatrick?: number;
      skinType?: string;
      mainComplaint?: string;
      goals?: string;
      contraindications?: string;
      observations?: string;
    }
  ) =>
    api
      .put<AestheticAssessment>(
        `/beauty-aesthetic/${establishmentId}/${clientId}/assessment`,
        data
      )
      .then((r) => r.data),

  // ---- estetica: mapa de aplicacao ----
  listApplications: (establishmentId: string, clientId: string) =>
    api
      .get<AestheticApplication[]>(
        `/beauty-aesthetic/${establishmentId}/${clientId}/applications`
      )
      .then((r) => r.data),

  addApplication: (
    establishmentId: string,
    clientId: string,
    data: {
      area: AestheticArea;
      region: string;
      procedure?: string;
      product?: string;
      amount?: string;
      date?: string;
      note?: string;
    }
  ) =>
    api
      .post<AestheticApplication>(
        `/beauty-aesthetic/${establishmentId}/${clientId}/applications`,
        data
      )
      .then((r) => r.data),

  removeApplication: (
    establishmentId: string,
    clientId: string,
    appId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `/beauty-aesthetic/${establishmentId}/${clientId}/applications/${appId}`
      )
      .then((r) => r.data),

  // ---- sobrancelha & cilios ----
  getBrowLash: (establishmentId: string, clientId: string) =>
    api
      .get<BrowLashProfile>(`/beauty-brows/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  updateBrowLash: (
    establishmentId: string,
    clientId: string,
    data: Partial<Omit<BrowLashProfile, "_id" | "establishment" | "client">>
  ) =>
    api
      .put<BrowLashProfile>(`/beauty-brows/${establishmentId}/${clientId}`, data)
      .then((r) => r.data),

  // ---- esterilizacao (do estabelecimento) ----
  listCycles: (establishmentId: string) =>
    api
      .get<SterilizationCycle[]>(`/sterilization/${establishmentId}`)
      .then((r) => r.data),

  addCycle: (
    establishmentId: string,
    data: {
      date?: string;
      equipment?: string;
      load?: string;
      cycle?: string;
      indicator?: SterilizationIndicator;
      responsible?: string;
      notes?: string;
    }
  ) =>
    api
      .post<SterilizationCycle>(`/sterilization/${establishmentId}`, data)
      .then((r) => r.data),

  removeCycle: (establishmentId: string, cycleId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/sterilization/${establishmentId}/${cycleId}`
      )
      .then((r) => r.data),

  // ---- massagem: avaliacao ----
  getMassageAssessment: (establishmentId: string, clientId: string) =>
    api
      .get<MassageAssessment>(
        `/beauty-massage/${establishmentId}/${clientId}/assessment`
      )
      .then((r) => r.data),

  updateMassageAssessment: (
    establishmentId: string,
    clientId: string,
    data: {
      mainComplaint?: string;
      tensionPoints?: string;
      contraindications?: string;
      goals?: string;
      observations?: string;
    }
  ) =>
    api
      .put<MassageAssessment>(
        `/beauty-massage/${establishmentId}/${clientId}/assessment`,
        data
      )
      .then((r) => r.data),

  // ---- massagem: sessoes ----
  listMassageSessions: (establishmentId: string, clientId: string) =>
    api
      .get<MassageSession[]>(
        `/beauty-massage/${establishmentId}/${clientId}/sessions`
      )
      .then((r) => r.data),

  addMassageSession: (
    establishmentId: string,
    clientId: string,
    data: {
      date?: string;
      technique?: string;
      regions?: string;
      evolution?: string;
      painBefore?: number | null;
      painAfter?: number | null;
    }
  ) =>
    api
      .post<MassageSession>(
        `/beauty-massage/${establishmentId}/${clientId}/sessions`,
        data
      )
      .then((r) => r.data),

  removeMassageSession: (
    establishmentId: string,
    clientId: string,
    sessionId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `/beauty-massage/${establishmentId}/${clientId}/sessions/${sessionId}`
      )
      .then((r) => r.data),
};
