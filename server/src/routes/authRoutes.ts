import { Router } from "express";
import { register, login, me, updateMe } from "../controllers/authController";
import { protect } from "../middleware/auth";
import { verifyEmail, resendVerification } from "../controllers/authController";
import { googleAuth } from "../controllers/authController";
import { getSavedCard, deleteSavedCard } from "../controllers/authController";
import {
  forgotPassword,
  validateResetToken,
  resetPassword,
  changePassword,
  acceptTerms,
} from "../controllers/authController";
import { AuthRequest } from "../middleware/auth";
import { createLimiter, clientIp, bodyEmail } from "../utils/rateLimit";

const router = Router();

const MIN = 60 * 1000;

// login: 10 tentativas / 15 min por IP + e-mail (freia forca bruta de senha)
const loginLimiter = createLimiter({
  windowMs: 15 * MIN,
  max: 10,
  key: (req) => `${clientIp(req)}|${bodyEmail(req)}`,
});
// esqueci a senha: por e-mail (evita bombardear a caixa de alguem)...
const forgotEmailLimiter = createLimiter({
  windowMs: 60 * MIN,
  max: 3,
  key: (req) => bodyEmail(req) || null,
  message:
    "Ja enviamos alguns links para este e-mail. Verifique sua caixa de entrada (e o spam) ou tente mais tarde.",
});
// ...e por IP (evita varrer muitos e-mails a partir de uma origem)
const forgotIpLimiter = createLimiter({
  windowMs: 15 * MIN,
  max: 20,
  key: (req) => clientIp(req),
});
// validar/usar o link de redefinicao
const resetLimiter = createLimiter({
  windowMs: 15 * MIN,
  max: 20,
  key: (req) => clientIp(req),
});
// trocar senha logado: por usuario (freia chute da senha atual)
const changeLimiter = createLimiter({
  windowMs: 15 * MIN,
  max: 5,
  key: (req) => (req as AuthRequest).userId || clientIp(req),
});

router.post("/register", register);
router.post("/login", loginLimiter, login);
// publicas: recuperacao de senha ("esqueci a senha")
router.post("/forgot-password", forgotIpLimiter, forgotEmailLimiter, forgotPassword);
router.get("/reset-password/:token", resetLimiter, validateResetToken);
router.post("/reset-password", resetLimiter, resetPassword);
// protegida: trocar a senha pelo perfil (exige a senha atual)
router.post("/change-password", protect, changeLimiter, changePassword);
// publica: login/cadastro com Google
router.post("/google", googleAuth);
// publica: o link do e-mail funciona sem login
router.post("/verify-email/:token", verifyEmail);
// protegida: reenviar para o usuario logado
router.post("/resend-verification", protect, resendVerification);
router.get("/me", protect, me);
// protegida: aceite dos Termos de Uso + Politica de Privacidade (LGPD)
router.post("/accept-terms", protect, acceptTerms);
router.patch("/me", protect, updateMe);
// cartao salvo do cliente (pagamento pelo app)
router.get("/saved-card", protect, getSavedCard);
router.delete("/saved-card", protect, deleteSavedCard);

export default router;