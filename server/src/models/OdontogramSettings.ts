import { Schema, model, Document, Types } from "mongoose";

// Configuracao do odontograma por estabelecimento: a lista de status que a
// clinica usa (com cores). Um documento por estabelecimento. Se nao existir,
// o backend/frontend usam DEFAULT_TOOTH_STATUSES.

export interface IStatusDef {
  key: string;
  label: string;
  color: string; // hex #rrggbb
}

export interface IOdontogramSettings extends Document {
  establishment: Types.ObjectId;
  statuses: IStatusDef[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const statusSchema = new Schema<IStatusDef>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, required: true },
  },
  { _id: false }
);

const settingsSchema = new Schema<IOdontogramSettings>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
      unique: true,
    },
    statuses: { type: [statusSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const OdontogramSettings = model<IOdontogramSettings>(
  "OdontogramSettings",
  settingsSchema
);