import { Schema, model, Document, Types } from "mongoose";

// Um membro da equipe do estabelecimento (acesso/permissao, com login).
export interface IMember {
  professional: Types.ObjectId;
  role: "owner" | "professional";
  active: boolean;
}

// Um PROFISSIONAL agendavel (barbeiro, dentista). Cadastro dentro do
// estabelecimento, SEM login proprio. linkedUser fica reservado para, no
// futuro, ligar este profissional a uma conta de usuario (opcional).
export interface IProfessionalDoc extends Types.Subdocument {
  _id: Types.ObjectId;
  name: string;
  photo?: string; // URL (S3 depois); string por enquanto
  specialties: string[];
  active: boolean;
  linkedUser: Types.ObjectId | null;
}

// Endereço estruturado
export interface IAddress {
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
}

export interface IEstablishment extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  category: Types.ObjectId;
  name: string;
  description?: string;
  phone?: string;
  address: IAddress;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  photo?: string; // foto de perfil / logo (URL S3)
  coverPhotos: string[]; // ate 6 fotos de capa (carrossel) — URLs S3
  members: IMember[];
  professionals: Types.DocumentArray<IProfessionalDoc>;
  active: boolean;
  cashAutoEntry: boolean; // lanca entrada no caixa ao concluir servico
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<IMember>(
  {
    professional: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["owner", "professional"],
      default: "professional",
    },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

// sub-doc COM _id proprio (precisamos referenciar cada profissional por id
// em agenda/booking nas proximas sub-etapas)
const professionalSchema = new Schema<IProfessionalDoc>({
  name: { type: String, required: true, trim: true },
  photo: { type: String, default: "" },
  specialties: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  linkedUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
});

const addressSchema = new Schema<IAddress>(
  {
    country: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    neighborhood: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const establishmentSchema = new Schema<IEstablishment>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    phone: { type: String, trim: true },
    address: { type: addressSchema, required: true },
    // GeoJSON para permitir busca por proximidade no futuro
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    photo: { type: String },
    // ate 6 fotos de capa, exibidas em carrossel no perfil publico
    coverPhotos: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 6,
        message: "Maximo de 6 fotos de capa",
      },
    },
    members: { type: [memberSchema], default: [] },
    professionals: { type: [professionalSchema], default: [] },
    active: { type: Boolean, default: true },
    cashAutoEntry: { type: Boolean, default: true },
  },
  { timestamps: true }
);

establishmentSchema.index({ owner: 1 });
establishmentSchema.index({ category: 1, active: 1 });
establishmentSchema.index({ "members.professional": 1 });
establishmentSchema.index({ "address.city": 1 });
// indice geoespacial para futuras buscas por proximidade
establishmentSchema.index({ location: "2dsphere" });

export const Establishment = model<IEstablishment>(
  "Establishment",
  establishmentSchema
);