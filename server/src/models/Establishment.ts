import { Schema, model, Document, Types } from "mongoose";
import { SEGMENTS, DEFAULT_SEGMENT, SegmentKey } from "../config/segments";

// Um membro da equipe do estabelecimento (acesso/permissao, com login).
export interface IMember {
  professional: Types.ObjectId;
  // "secretary" = atendente que organiza a agenda de todos, sem prestar servico
  role: "owner" | "professional" | "secretary";
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
  // area/segmento do estabelecimento — define quais modulos ele libera
  segment: SegmentKey;
  // ciclo de cobranca (mensal | anual). Anual = 2 meses gratis.
  billingCycle: "mensal" | "anual";
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
  // atendimento a domicilio (padrao do estabelecimento; cada servico pode
  // sobrescrever a taxa). enabled=false => nenhum servico atende a domicilio,
  // mesmo que o servico esteja marcado como "ambos/domicilio".
  homeService: {
    enabled: boolean;
    avgSpeedKmh: number; // velocidade media p/ estimar o tempo de deslocamento
    baseFee: number; // taxa fixa de deslocamento (R$)
    feePerKm: number; // taxa por km rodado (ida e volta) (R$)
    maxRadiusKm: number; // distancia maxima atendida (0 = sem limite)
  };
  // nota agregada (sistema de avaliacao). Recalculados a cada avaliacao no
  // reviewController; ficam no proprio doc para os cards/busca/perfil
  // exibirem a nota sem consultar a colecao de reviews.
  ratingAvg: number; // media das estrelas (0 quando nao ha avaliacoes)
  ratingCount: number; // total de avaliacoes
  // Recebimentos (Fluxo 2): subconta Asaas para receber pagamentos do cliente
  // via split. Vazio = ainda nao configurou (nao recebe pagamentos pelo app).
  asaasAccountId: string;
  asaasWalletId: string;
  asaasApiKey: string; // chave da subconta: cobra direto nela (empresa fora)
  receivablesActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<IMember>(
  {
    professional: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["owner", "professional", "secretary"],
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
    // area do estabelecimento (beleza, saude, odontologia...)
    segment: {
      type: String,
      enum: Object.keys(SEGMENTS),
      default: DEFAULT_SEGMENT,
    },
    // ciclo de cobranca escolhido no cadastro (anual = 2 meses gratis)
    billingCycle: {
      type: String,
      enum: ["mensal", "anual"],
      default: "mensal",
    },
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
    // atendimento a domicilio (padrao do estabelecimento)
    homeService: {
      enabled: { type: Boolean, default: false },
      avgSpeedKmh: { type: Number, default: 25, min: 1 },
      baseFee: { type: Number, default: 0, min: 0 },
      feePerKm: { type: Number, default: 0, min: 0 },
      maxRadiusKm: { type: Number, default: 0, min: 0 },
    },
    // nota agregada do sistema de avaliacao
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    // recebimentos (subconta Asaas p/ split)
    asaasAccountId: { type: String, default: "" },
    asaasWalletId: { type: String, default: "" },
    asaasApiKey: { type: String, default: "" },
    receivablesActive: { type: Boolean, default: false },
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