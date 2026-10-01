import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Affiliate } from "../models/Affiliate";
import { Subscription } from "../models/Subscription";
import { getPaymentProvider } from "../services/payments";
import { effectivePlanCents } from "./coupons";

// Migracao unica: comissao dos afiliados 25% -> 30%.
//  1) afiliados que estao em 25% passam para 30% (o default do model ja e 30
//     para os novos; as comissoes "a repassar" futuras ja saem com 30%)
//  2) assinaturas ativas com split no Asaas: atualiza o fixedValue do split
//     para 30% do plano (updatePendingPayments=true -> cobrancas ja geradas e
//     ainda pendentes tambem passam a repassar 30%)
// Comissoes ja pagas/registradas NAO sao alteradas (historico).
//
// Rodar:  npm run migrate:affiliate30          (aplica)
//         npm run migrate:affiliate30 -- --dry (so mostra o que faria)

const FROM = 25;
const TO = 30;
const dry = process.argv.includes("--dry");

const run = async (): Promise<void> => {
  await connectDB();
  console.log(dry ? "🔎 DRY-RUN (nada sera alterado)" : "✏️  Aplicando...");

  // 1) afiliados
  const affs = await Affiliate.find({ commissionPercent: FROM }).select("_id");
  console.log(`Afiliados em ${FROM}%: ${affs.length}`);
  if (!dry && affs.length) {
    await Affiliate.updateMany(
      { commissionPercent: FROM },
      { $set: { commissionPercent: TO } }
    );
  }

  // 2) split das assinaturas no gateway
  const provider = getPaymentProvider();
  const subs = await Subscription.find({
    affiliate: { $ne: null },
    affiliateWalletId: { $ne: "" },
    providerSubscriptionId: { $ne: "" },
    status: { $in: ["active", "trialing", "past_due"] },
  });
  console.log(`Assinaturas com split ativo: ${subs.length}`);

  let ok = 0;
  let fail = 0;
  for (const sub of subs) {
    const aff = await Affiliate.findById(sub.affiliate).select("commissionPercent");
    const pct = dry ? TO : aff?.commissionPercent || TO;
    const commission = Math.round(
      (effectivePlanCents(sub, sub.priceCents) * pct) / 100
    );
    console.log(
      `  sub=${sub._id} gateway=${sub.providerSubscriptionId} ` +
        `plano=${(sub.priceCents / 100).toFixed(2)} -> split ${pct}% = R$ ${(commission / 100).toFixed(2)}`
    );
    if (dry) continue;
    if (!provider.updateSubscriptionSplit) {
      console.log("  ⚠️  gateway sem updateSubscriptionSplit (noop?) — pulando");
      continue;
    }
    try {
      await provider.updateSubscriptionSplit(
        sub.providerSubscriptionId,
        sub.affiliateWalletId,
        commission
      );
      ok++;
    } catch (e) {
      fail++;
      console.error(`  ❌ falhou: ${(e as Error).message}`);
    }
  }

  if (!dry) console.log(`✅ Split atualizado: ${ok}  |  falhas: ${fail}`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
};

run();
