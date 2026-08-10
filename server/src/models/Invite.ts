import { Schema, model, Document, Types } from "mongoose";
import crypto from "crypto";

// Convite para um profissional (subdoc de Establishment.professionals) ganhar
// login e virar membro operacional do estabelecimento.
export interface IInvite extends Document {
  establishment: Types.ObjectId;
  professionalId: Types.ObjectId; // _id do subdoc em Establishment.professionals
  email: string;
  tokenHash: string; // guardamos o hash, nunca o token cru
  status: "pendente" | "aceito" | "cancelado" | "expirado";
  invitedBy: Types.ObjectId; // dono que convidou
  acceptedBy: Types.ObjectId | null; // User que aceitou
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inviteSchema = new Schema<IInvite>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    professionalId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pendente", "aceito", "cancelado", "expirado"],
      default: "pendente",
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

inviteSchema.index({ establishment: 1, professionalId: 1, status: 1 });
inviteSchema.index({ email: 1, status: 1 });

// gera um token cru (vai no link/email) e devolve {token, tokenHash}.
// so o hash e persistido; o token cru so existe no momento do convite.
export const generateInviteToken = (): {
  token: string;
  tokenHash: string;
} => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
};

// hash de um token recebido, para comparar com o armazenado
export const hashInviteToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const Invite = model<IInvite>("Invite", inviteSchema);