import { Schema, model, Document, Types } from "mongoose";

// Atendimento datado de ACUPUNTURA. Cada sessao registra:
//  - eva: dor/evolucao (0-10)
//  - retentionMin: tempo de retencao das agulhas (min)
//  - points: PONTOS APLICADOS (ponto, lado, metodo, estimulo)
//  - tcmNotes: padrao/observacao MTC do dia
//  - orientacoes e proxima visita
// Varios por paciente (datados) → acompanhamento (EVA, pontos usados).

export interface IPoint {
  point: string; // ponto (ex.: IG4, E36, VG20)
  side: string; // "" | D | E | bilateral | central
  method: string; // agulha | moxa | eletro | ventosa | auricular | laser
  stimulation: string; // "" | tonificar | sedar | neutro
  note: string;
}

export interface IAcupunctureSession extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem atendeu
  date: Date;
  eva: number; // dor/evolucao 0-10
  retentionMin: number; // tempo de retencao (min)
  points: Types.DocumentArray<IPoint & Document>;
  tcmNotes: string; // padrao/observacao MTC do dia
  recommendations: string;
  notes: string;
  nextVisit?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pointSchema = new Schema<IPoint>(
  {
    point: { type: String, default: "", trim: true },
    side: { type: String, default: "", trim: true },
    method: { type: String, default: "", trim: true },
    stimulation: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const acupunctureSessionSchema = new Schema<IAcupunctureSession>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    eva: { type: Number, default: 0, min: 0, max: 10 },
    retentionMin: { type: Number, default: 0, min: 0 },
    points: { type: [pointSchema], default: [] },
    tcmNotes: { type: String, default: "", trim: true },
    recommendations: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    nextVisit: { type: Date },
  },
  { timestamps: true }
);

acupunctureSessionSchema.index({ establishment: 1, client: 1, date: -1 });

export const AcupunctureSession = model<IAcupunctureSession>(
  "AcupunctureSession",
  acupunctureSessionSchema
);
