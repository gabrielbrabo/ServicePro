import { api } from "../lib/api";

export interface Review {
  _id: string;
  client: string;
  establishment: string;
  booking: string;
  professional: string | null;
  rating: number; // 1..5
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitReviewResult {
  review: Review;
  ratingAvg: number;
  ratingCount: number;
}

// avaliacao com dados populados, do ponto de vista do estabelecimento
export interface EstablishmentReview {
  _id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  client: { _id: string; name: string; avatar?: string } | null;
  service: { _id: string; title: string } | null;
}

export interface EstablishmentReviewsResult {
  reviews: EstablishmentReview[];
  ratingAvg: number;
  ratingCount: number;
}

export const reviewApi = {
  // cria/atualiza a avaliacao de um agendamento concluido
  submit: (data: { bookingId: string; rating: number; comment?: string }) =>
    api.post<SubmitReviewResult>("/reviews", data).then((r) => r.data),

  // avaliacao existente do cliente para aquele agendamento (ou null)
  getByBooking: (bookingId: string) =>
    api
      .get<{ review: Review | null }>(`/reviews/booking/${bookingId}`)
      .then((r) => r.data.review),

  // avaliacoes recebidas pelo estabelecimento (dono/funcionario)
  listByEstablishment: (establishmentId: string) =>
    api
      .get<EstablishmentReviewsResult>(
        `/reviews/establishment/${establishmentId}`
      )
      .then((r) => r.data),

  // avaliacoes publicas (carrossel na pagina do estabelecimento)
  listPublic: (establishmentId: string) =>
    api
      .get<{ reviews: EstablishmentReview[] }>(
        `/reviews/public/${establishmentId}`
      )
      .then((r) => r.data.reviews),
};