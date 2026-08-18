import { Router } from "express";
import { protect } from "../middleware/auth";
import {
  createOrUpdateReview,
  getReviewByBooking,
  listEstablishmentReviews,
  listPublicReviews,
} from "../controllers/reviewController";

const router = Router();

// avaliacoes publicas de um estabelecimento (carrossel na pagina publica)
router.get("/public/:establishmentId", listPublicReviews);

// cria/atualiza a avaliacao do cliente (por servico do agendamento)
router.post("/", protect, createOrUpdateReview);
// avaliacao existente do cliente para aquele agendamento (para editar)
router.get("/booking/:bookingId", protect, getReviewByBooking);
// avaliacoes recebidas pelo estabelecimento (dono/funcionario)
router.get("/establishment/:establishmentId", protect, listEstablishmentReviews);

export default router;