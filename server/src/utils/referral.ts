import { Types } from "mongoose";
import { Affiliate } from "../models/Affiliate";
import { User } from "../models/User";

// extrai o codigo de indicacao de um link (…/?ref=CODE) ou aceita o codigo cru
export function extractRefCode(input: unknown): string {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s) return "";
  const m = s.match(/[?&]ref=([^&#\s]+)/i);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return s;
}

export type ResolvedReferral =
  | {
      ok: true;
      affiliateId: Types.ObjectId;
      affiliateName: string;
      code: string;
      walletId: string;
      percent: number;
    }
  | { ok: false; message: string };

// valida um link/codigo de afiliado para o usuario `userId`:
// afiliado precisa existir e estar ativo, e nao pode ser o proprio usuario.
export async function resolveReferral(
  refRaw: unknown,
  userId: string
): Promise<ResolvedReferral> {
  const code = extractRefCode(refRaw);
  if (!code) {
    return { ok: false, message: "Informe o link do afiliado/representante" };
  }
  const aff = await Affiliate.findOne({ code, status: "active" })
    .select("_id user code asaasWalletId commissionPercent")
    .populate("user", "name");
  if (!aff) {
    return {
      ok: false,
      message:
        "Link de afiliado não encontrado. Confira se copiou o link completo.",
    };
  }
  const affUser = aff.user as unknown as { _id: Types.ObjectId; name?: string };
  if (affUser?._id?.toString() === userId) {
    return { ok: false, message: "Você não pode usar o seu próprio link" };
  }
  return {
    ok: true,
    affiliateId: aff._id,
    affiliateName: affUser?.name || "Afiliado",
    code: aff.code,
    walletId: aff.asaasWalletId || "",
    percent: aff.commissionPercent || 25,
  };
}

// vincula o usuario ao afiliado (so se ainda nao tiver indicacao)
export async function setUserReferrer(
  userId: string,
  affiliateId: Types.ObjectId
): Promise<boolean> {
  const r = await User.updateOne(
    { _id: userId, $or: [{ referredByAffiliate: null }, { referredByAffiliate: { $exists: false } }] },
    { $set: { referredByAffiliate: affiliateId } }
  );
  return r.modifiedCount > 0;
}
