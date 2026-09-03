import { Schema, model, Document, Types } from "mongoose";

// Registro datado de ENFERMAGEM. Um unico modelo com `kind` cobre os tres tipos
// para uma evolucao cronologica simples:
//   - vital: sinais vitais (PA, FC, FR, Temp, SpO2, glicemia, dor)
//   - dressing: curativo (local, aspecto, tipo, materiais)
//   - medication: aplicacao de medicacao/vacina (nome, dose, via, local, lote)
// Campos fora do tipo ficam no default (0 / "") e sao ignorados pela UI.

export type NursingKind = "vital" | "dressing" | "medication";

export interface INursingRecord extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem registrou
  kind: NursingKind;
  date: Date;
  notes: string;

  // sinais vitais (0 = nao medido)
  systolic: number; // PA sistolica (mmHg)
  diastolic: number; // PA diastolica (mmHg)
  heartRate: number; // FC (bpm)
  respRate: number; // FR (irpm)
  temperature: number; // Temp (C)
  spo2: number; // SpO2 (%)
  glucose: number; // glicemia (mg/dL)
  pain: number; // dor (0-10)

  // curativo
  location: string; // local / regiao da ferida
  aspect: string; // aspecto da ferida / evolucao
  dressingType: string; // tipo de curativo/cobertura
  materials: string; // materiais / coberturas usadas

  // medicacao / vacina
  medKind: string; // "" | medicacao | vacina
  name: string; // nome do medicamento/vacina
  dose: string; // dose (texto: "500 mg", "0,5 mL")
  route: string; // via (VO, IM, EV, SC, ID, topica...)
  site: string; // local de aplicacao (ex.: deltoide D)
  lot: string; // lote (vacina)
  expiry?: Date; // validade (vacina)

  createdAt: Date;
  updatedAt: Date;
}

const nursingRecordSchema = new Schema<INursingRecord>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: {
      type: String,
      enum: ["vital", "dressing", "medication"],
      required: true,
    },
    date: { type: Date, default: Date.now },
    notes: { type: String, default: "", trim: true },

    systolic: { type: Number, default: 0, min: 0 },
    diastolic: { type: Number, default: 0, min: 0 },
    heartRate: { type: Number, default: 0, min: 0 },
    respRate: { type: Number, default: 0, min: 0 },
    temperature: { type: Number, default: 0, min: 0 },
    spo2: { type: Number, default: 0, min: 0 },
    glucose: { type: Number, default: 0, min: 0 },
    pain: { type: Number, default: 0, min: 0 },

    location: { type: String, default: "", trim: true },
    aspect: { type: String, default: "", trim: true },
    dressingType: { type: String, default: "", trim: true },
    materials: { type: String, default: "", trim: true },

    medKind: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    dose: { type: String, default: "", trim: true },
    route: { type: String, default: "", trim: true },
    site: { type: String, default: "", trim: true },
    lot: { type: String, default: "", trim: true },
    expiry: { type: Date },
  },
  { timestamps: true }
);

nursingRecordSchema.index({ establishment: 1, client: 1, kind: 1, date: -1 });

export const NursingRecord = model<INursingRecord>(
  "NursingRecord",
  nursingRecordSchema
);
