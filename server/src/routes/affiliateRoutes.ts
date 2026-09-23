import { Router } from "express";
import {
  registerAffiliate,
  loginAffiliate,
  getMyAffiliate,
  getMyReferrals,
  getMyWallet,
  getMyReferrer,
} from "../controllers/affiliateController";
import { protect, optionalProtect } from "../middleware/auth";
import { createLimiter, clientIp, bodyEmail } from "../utils/rateLimit";

const router = Router();

// login do afiliado: mesmo freio do login principal (10 / 15 min por IP + e-mail)
const affiliateLoginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${clientIp(req)}|${bodyEmail(req)}`,
});

// cadastro aberto do afiliado/representante. optionalProtect: se ja estiver
// logado, reaproveita a conta; senao, cria uma nova.
router.post("/register", optionalProtect, registerAffiliate);
// login da area propria do afiliado
router.post("/login", affiliateLoginLimiter, loginAffiliate);
// dados da conta de afiliado do usuario logado
router.get("/me", protect, getMyAffiliate);
// lista de indicados + resumo de comissoes (previsto) para o painel
router.get("/me/referrals", protect, getMyReferrals);
// saldo da subconta + link para sacar dentro do Asaas
router.get("/me/wallet", protect, getMyWallet);
// se o usuario logado ja foi indicado por um afiliado (e por quem) -> usado no
// cadastro de estabelecimento para travar o campo de link de indicacao.
router.get("/my-referrer", protect, getMyReferrer);

export default router;
