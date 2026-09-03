import { Schema, model, Document, Types } from "mongoose";

// Evolucao clinica (nota SOAP) de um PACIENTE dentro de um ESTABELECIMENTO.
// Diferente da ficha (MedicalRecord, uma por paciente): aqui sao VARIAS,
// uma por atendimento/consulta. Estrutura SOAP:
//   S - subjetivo  (queixa/relato do paciente)
//   O - objetivo   (exame fisico, medidas, observacoes)
//   A - avaliacao  (hipotese/diagnostico, evolucao do quadro)
//   P - plano      (conduta, prescricao, proximos passos)
// Serve clinica, fisioterapia e odontologia. Dado sensivel: so dono/equipe.

export interface IEvolutionCid {
  code: string; // ex.: "M54.5"
  description: string; // ex.: "Dor lombar baixa"
}

export interface IEvolution extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem escreveu (dono/membro)
  booking?: Types.ObjectId; // atendimento vinculado (opcional)
  date: Date; // data clinica da evolucao (default: agora)
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  cids: IEvolutionCid[]; // diagnosticos CID-10 (opcional)
  nextReturn?: Date; // retorno previsto / recall (opcional)
  returnService?: Types.ObjectId; // servico do retorno (p/ agendar)
  returnProfessional?: Types.ObjectId | null;
  returnBookingId?: Types.ObjectId | null; // agendamento gerado do retorno
  createdAt: Date;
  updatedAt: Date;
}

const cidSchema = new Schema<IEvolutionCid>(
  {
    code: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const evolutionSchema = new Schema<IEvolution>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    date: { type: Date, default: Date.now },
    subjective: { type: String, default: "", trim: true },
    objective: { type: String, default: "", trim: true },
    assessment: { type: String, default: "", trim: true },
    plan: { type: String, default: "", trim: true },
    cids: { type: [cidSchema], default: [] },
    nextReturn: { type: Date },
    returnService: { type: Schema.Types.ObjectId, ref: "Service" },
    returnProfessional: { type: Schema.Types.ObjectId, default: null },
    returnBookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true }
);

// listagem da evolucao de um paciente (mais recente primeiro)
evolutionSchema.index({ establishment: 1, client: 1, date: -1 });

export const Evolution = model<IEvolution>("Evolution", evolutionSchema);
