import { Schema, model, Document, Types } from "mongoose";

// Periograma (exame periodontal) de um PACIENTE num ESTABELECIMENTO. Um por
// (paciente + estabelecimento), evolui no tempo (como o odontograma). Guarda so
// os dentes examinados.
//
// Cada dente tem 6 sitios (indices 0..5):
//   0 Mesio-Vestibular  1 Vestibular  2 Disto-Vestibular
//   3 Mesio-Lingual     4 Lingual     5 Disto-Lingual
// pd  = profundidade de sondagem (mm) por sitio
// rec = recessao/margem gengival (mm) por sitio  (NIC/CAL = pd + rec)
// bop = sangramento a sondagem por sitio (boolean)
// mobility  = 0..3   furcation = 0..3

export interface IPerioTooth {
  number: number;
  pd: number[]; // 6
  rec: number[]; // 6
  bop: boolean[]; // 6
  mobility: number; // 0-3
  furcation: number; // 0-3
  note?: string;
}

export interface IPeriogram extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId;
  teeth: IPerioTooth[];
  createdAt: Date;
  updatedAt: Date;
}

const perioToothSchema = new Schema<IPerioTooth>(
  {
    number: { type: Number, required: true },
    pd: { type: [Number], default: () => [0, 0, 0, 0, 0, 0] },
    rec: { type: [Number], default: () => [0, 0, 0, 0, 0, 0] },
    bop: {
      type: [Boolean],
      default: () => [false, false, false, false, false, false],
    },
    mobility: { type: Number, default: 0, min: 0, max: 3 },
    furcation: { type: Number, default: 0, min: 0, max: 3 },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const periogramSchema = new Schema<IPeriogram>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teeth: { type: [perioToothSchema], default: [] },
  },
  { timestamps: true }
);

periogramSchema.index({ establishment: 1, client: 1 }, { unique: true });

export const Periogram = model<IPeriogram>("Periogram", periogramSchema);
