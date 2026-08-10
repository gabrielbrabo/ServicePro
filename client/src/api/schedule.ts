import { api } from "../lib/api";

// Horario de funcionamento de um dia
export interface WorkingHour {
  dayOfWeek: number; // 0=domingo ... 6=sabado
  startMinute: number; // minutos desde 00:00
  endMinute: number;
}

// Intervalo em que ninguem pode agendar (almoco, cafe, etc)
export interface Break {
  dayOfWeek: number | null; // null = todos os dias
  startMinute: number;
  endMinute: number;
  label?: string;
}

// Agenda completa do estabelecimento (ou de um profissional)
export interface Availability {
  establishment: string;
  professional?: string | null;
  workingHours: WorkingHour[];
  breaks: Break[];
  minAdvanceMinutes: number;
  maxFutureDays: number;
}

// Bloqueio pontual por data (bloqueio/feriado/ferias)
export type TimeBlockType = "bloqueio" | "feriado" | "ferias";

export interface TimeBlock {
  _id: string;
  establishment: string;
  professional?: string | null;
  type: TimeBlockType;
  startAt: string;
  endAt: string;
  allDay: boolean;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingAddress {
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
}

export interface Booking {
  _id: string;
  client: { _id: string; name: string; avatar?: string; phone?: string };
  establishment: {
    _id: string;
    name: string;
    photo?: string;
    phone?: string;
    address?: BookingAddress;
    location?: { type: "Point"; coordinates: [number, number] }; // [lon, lat]
  };
  service: {
    _id: string;
    title: string;
    price: number;
    durationMinutes: number;
    description?: string;
    photos?: string[];
  };
  professional?: string | null; // id do subdoc em Establishment.professionals
  professionalName?: string | null; // anexado pelo backend (nao ha populate de subdoc)
  scheduledAt: string;
  endsAt: string;
  status: "pendente" | "confirmado" | "concluido" | "cancelado" | "reservado";
  notes?: string;
  payment: { status: string; amount: number };
  clientReminderMinutes?: number | null;
  ownerReminderMinutes?: number | null;
  seriesId?: string | null;
  reservationExpiresAt?: string;
  fromWaitlist?: string | null;
}

// Entrada na lista de espera
export type WaitlistStatus =
  | "aguardando"
  | "notificado"
  | "atendido"
  | "cancelado";

export interface WaitlistEntry {
  _id: string;
  client: { _id: string; name: string; avatar?: string };
  establishment: { _id: string; name: string };
  service: {
    _id: string;
    title: string;
    price: number;
    durationMinutes: number;
  };
  professional: string | null;
  targetDate: string | null;
  status: WaitlistStatus;
  notifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const scheduleApi = {
  // agenda de um estabelecimento; professional opcional (agenda por profissional)
  setAvailability: (
    establishmentId: string,
    data: Omit<Availability, "establishment">,
    professional?: string | null
  ) =>
    api
      .put<Availability>(`/availability/${establishmentId}`, {
        ...data,
        professional: professional ?? undefined,
      })
      .then((r) => r.data),

  getAvailability: (establishmentId: string, professional?: string | null) =>
    api
      .get<Availability>(`/availability/${establishmentId}`, {
        params: professional ? { professional } : undefined,
      })
      .then((r) => r.data),

  // horarios livres de um servico num dia; professional opcional
  freeSlots: (serviceId: string, date: string, professional?: string | null) =>
    api
      .get<{ date: string; slots: string[] }>(`/services/${serviceId}/slots`, {
        params: professional ? { date, professional } : { date },
      })
      .then((r) => r.data),

  createBooking: (data: {
    serviceId: string;
    scheduledAt: string;
    notes?: string;
    address?: string;
    professionalId?: string | null;
    clientReminderMinutes?: number | null;
  }) => api.post<Booking>("/bookings", data).then((r) => r.data),

  // cria uma serie recorrente; devolve criados e pulados
  createRecurring: (data: {
    serviceId: string;
    scheduledAt: string;
    professionalId?: string | null;
    notes?: string;
    address?: string;
    frequency: "semanal" | "quinzenal";
    repetitions: number;
    clientReminderMinutes?: number | null;
  }) =>
    api
      .post<{
        seriesId: string;
        createdCount: number;
        skippedCount: number;
        created: Booking[];
        skipped: { date: string; reason: string }[];
      }>("/bookings/recurring", data)
      .then((r) => r.data),

  cancelSeries: (seriesId: string) =>
    api
      .delete<{ message: string; cancelledCount: number }>(
        `/bookings/series/${seriesId}`
      )
      .then((r) => r.data),

  listBookings: (role: "client" | "provider", establishmentId?: string) =>
    api
      .get<Booking[]>("/bookings", {
        params: { role, establishment: establishmentId },
      })
      .then((r) => r.data),

  updateStatus: (
    id: string,
    status: Booking["status"],
    paymentMethod?: "dinheiro" | "cartao" | "pix" | "outro",
    ownerReminderMinutes?: number
  ) =>
    api
      .patch<Booking>(`/bookings/${id}/status`, {
        status,
        paymentMethod,
        ownerReminderMinutes,
      })
      .then((r) => r.data),

  reschedule: (id: string, scheduledAt: string) =>
    api
      .patch<Booking>(`/bookings/${id}/reschedule`, { scheduledAt })
      .then((r) => r.data),

  // ---- bloqueios pontuais ----

  listTimeBlocks: (
    establishmentId: string,
    range?: { from?: string; to?: string }
  ) =>
    api
      .get<TimeBlock[]>(`/timeblocks/${establishmentId}`, { params: range })
      .then((r) => r.data),

  createTimeBlock: (
    establishmentId: string,
    data: {
      type?: TimeBlockType;
      startAt: string;
      endAt: string;
      allDay?: boolean;
      label?: string;
      professional?: string | null;
    }
  ) =>
    api
      .post<TimeBlock>(`/timeblocks/${establishmentId}`, data)
      .then((r) => r.data),

  deleteTimeBlock: (establishmentId: string, blockId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/timeblocks/${establishmentId}/${blockId}`
      )
      .then((r) => r.data),

  // ---- lista de espera ----

  joinWaitlist: (data: {
    serviceId: string;
    targetDate?: string;
    professionalId?: string | null;
  }) => api.post<WaitlistEntry>("/waitlist", data).then((r) => r.data),

  listWaitlist: (role: "client" | "provider", establishmentId?: string) =>
    api
      .get<WaitlistEntry[]>("/waitlist", {
        params: { role, establishment: establishmentId },
      })
      .then((r) => r.data),

  leaveWaitlist: (id: string) =>
    api
      .delete<{ message: string; _id: string }>(`/waitlist/${id}`)
      .then((r) => r.data),
  // aceita uma reserva automatica (vira pendente, aguarda confirmacao do dono)
  acceptReservation: (id: string) =>
    api
      .patch<Booking>(`/bookings/${id}/accept-reservation`)
      .then((r) => r.data),

  // recusa a reserva (libera a vaga para o proximo da fila)
  declineReservation: (id: string) =>
    api
      .patch<Booking>(`/bookings/${id}/decline-reservation`)
      .then((r) => r.data),
};