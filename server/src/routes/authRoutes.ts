import { Router } from "express";
import { register, login, me, updateMe } from "../controllers/authController";
import { protect } from "../middleware/auth";
import { verifyEmail, resendVerification } from "../controllers/authController";
import { googleAuth } from "../controllers/authController";
import { getSavedCard, deleteSavedCard } from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
// publica: login/cadastro com Google
router.post("/google", googleAuth);
// publica: o link do e-mail funciona sem login
router.post("/verify-email/:token", verifyEmail);
// protegida: reenviar para o usuario logado
router.post("/resend-verification", protect, resendVerification);
router.get("/me", protect, me);
router.patch("/me", protect, updateMe);
// cartao salvo do cliente (pagamento pelo app)
router.get("/saved-card", protect, getSavedCard);
router.delete("/saved-card", protect, deleteSavedCard);

export default router;