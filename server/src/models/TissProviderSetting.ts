import { Schema, model, Document, Types } from "mongoose";

// Dados do prestador para gerar o XML TISS (Fase 2). Um por estabelecimento.
// Complementa o que a guia (InsuranceClaim) e o convenio (HealthPlan) ja tem.

export interface ITissProviderSetting extends Document {
  establishment: Types.ObjectId;
  cnpj?: string; // CNPJ do prestador/contratado
  cnes?: string; // codigo CNES do estabelecimento de saude
  providerCode?: string; // codigo do prestador na operadora
  contractedName?: string; // nome do contratado (default = nome do estab.)
  tissVersion: string; // versao do padrao (ex: 4.03.00)
  // profissional executante padrao (para clinicas de 1 profissional)
  profName?: string;
  councilCode?: string; // conselho (tabela 26 TISS; ex: 01=CRM, ...)
  councilNumber?: string;
  councilUF?: string;
  cbo?: string; // CBO-S do profissional
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new Schema<ITissProviderSetting>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
      unique: true,
    },
    cnpj: { type: String, trim: true },
    cnes: { type: String, trim: true },
    providerCode: { type: String, trim: true },
    contractedName: { type: String, trim: true },
    tissVersion: { type: String, default: "4.03.00" },
    profName: { type: String, trim: true },
    councilCode: { type: String, trim: true },
    councilNumber: { type: String, trim: true },
    councilUF: { type: String, trim: true, uppercase: true },
    cbo: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const TissProviderSetting = model<ITissProviderSetting>(
  "TissProviderSetting",
  settingSchema
);
