import { Schema, model, Document, Types } from "mongoose";

// Registro de auditoria (LGPD): quem acessou/alterou dados de paciente, quando
// e onde. Gerado automaticamente pelo middleware `audit` nas rotas clinicas
// (prontuario, odontograma, plano de tratamento, documentos).

export type AuditAction = "view" | "create" | "update" | "delete" | "other";

export interface IAuditLog extends Document {
  establishment: Types.ObjectId;
  client?: Types.ObjectId; // paciente (quando a rota identifica um)
  actor?: Types.ObjectId; // usuario que fez a acao
  action: AuditAction;
  resource: string; // prontuario | odontograma | plano_tratamento | documento
  method?: string;
  path?: string;
  status?: number;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditSchema = new Schema<IAuditLog>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User" },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    action: {
      type: String,
      enum: ["view", "create", "update", "delete", "other"],
      required: true,
    },
    resource: { type: String, required: true },
    method: { type: String },
    path: { type: String },
    status: { type: Number },
    ip: { type: String },
  },
  { timestamps: true }
);

// consultas do painel de auditoria (mais novo primeiro), por estab. e paciente
auditSchema.index({ establishment: 1, createdAt: -1 });
auditSchema.index({ establishment: 1, client: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", auditSchema);
