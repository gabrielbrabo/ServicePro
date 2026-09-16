import { Schema, model, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password?: string; // opcional: contas Google nao tem senha
  authProvider: "local" | "google";
  googleId?: string;
  phone?: string;
  avatar?: string;
  country?: string;
  state?: string;
  city?: string;
  // Registro profissional (para preencher documentos: atestado, receita...)
  councilType?: string; // CRO, CRM, CREFITO, CRMV, CRP, CRN, COREN...
  councilState?: string; // UF do registro (ex: SP)
  councilNumber?: string; // numero do registro
  whatsappOptIn?: boolean; // aceita receber avisos por WhatsApp (default true)
  rating: number;
  ratingCount: number;
  // pagamento: cliente na conta da empresa (Asaas) + cartao salvo (token),
  // reutilizavel em qualquer estabelecimento
  asaasCustomerId?: string;
  savedCard?: { token: string; last4: string; brand: string };
  emailVerified: boolean;
  emailTokenHash?: string; // hash do token de verificacao (nunca o token cru)
  emailTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // senha exigida apenas para contas locais (Google nao usa senha)
    password: {
      type: String,
      minlength: 6,
      select: false,
      required: function (this: { authProvider?: string }) {
        return this.authProvider !== "google";
      },
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: { type: String, index: true, sparse: true },
    phone: { type: String, trim: true },
    avatar: { type: String },
    // verificacao de e-mail
    emailVerified: { type: Boolean, default: false },
    emailTokenHash: { type: String, select: false },
    emailTokenExpiry: { type: Date, select: false },
    // localizacao do usuario
    country: { type: String, trim: true, default: "Brasil" },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    // registro profissional (opcional; usado nos documentos clinicos)
    councilType: { type: String, trim: true, uppercase: true },
    councilState: { type: String, trim: true, uppercase: true },
    councilNumber: { type: String, trim: true },
    // avisos por WhatsApp (LGPD): default true; cliente pode dar opt-out
    whatsappOptIn: { type: Boolean, default: true },
    // Nota media como prestador (calculada a partir das Reviews)
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    // pagamento pelo app: cartao salvo (token do Asaas na conta da empresa)
    asaasCustomerId: { type: String, default: "", select: false },
    savedCard: {
      type: new Schema(
        {
          token: { type: String, default: "" },
          last4: { type: String, default: "" },
          brand: { type: String, default: "" },
        },
        { _id: false }
      ),
      default: undefined,
      select: false,
    },
  },
  { timestamps: true }
);

// Faz o hash da senha antes de salvar, somente se mudou
userSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (
  candidate: string
): Promise<boolean> {
  // conta sem senha (Google) nunca autentica por senha
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>("User", userSchema);
