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
  rating: number;
  ratingCount: number;
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
    // Nota media como prestador (calculada a partir das Reviews)
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
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