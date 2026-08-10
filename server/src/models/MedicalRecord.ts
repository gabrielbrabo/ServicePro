import { Schema, model, Document, Types } from "mongoose";

// Prontuario de um CLIENTE dentro de um ESTABELECIMENTO.
// Um por (cliente + estabelecimento). Dado sensivel: so dono/equipe acessam.
//
// Campos fixos: alergias, medicamentos, observacoes (texto corrido).
// notes: historico de anotacoes datadas (evolucao do atendimento).

export interface IRecordNote {
  _id: Types.ObjectId;
  text: string;
  author: Types.ObjectId; // quem escreveu (dono/membro)
  createdAt: Date;
}

export interface IMedicalRecord extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  allergies: string;
  medications: string;
  observations: string;
  notes: Types.DocumentArray<IRecordNote>;
  createdAt: Date;
  updatedAt: Date;
}

const recordNoteSchema = new Schema<IRecordNote>(
  {
    text: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  }
  // mantem _id proprio para poder remover uma anotacao especifica
);

const medicalRecordSchema = new Schema<IMedicalRecord>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    allergies: { type: String, default: "" },
    medications: { type: String, default: "" },
    observations: { type: String, default: "" },
    notes: { type: [recordNoteSchema], default: [] },
  },
  { timestamps: true }
);

// um prontuario por cliente+estabelecimento
medicalRecordSchema.index(
  { establishment: 1, client: 1 },
  { unique: true }
);

export const MedicalRecord = model<IMedicalRecord>(
  "MedicalRecord",
  medicalRecordSchema
);