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
  // combo: servicos adicionais no mesmo agendamento. [] / ausente = servico unico.
  items?: {
    service: string;
    title: string;
    price: number;
    durationMinutes: number;
  }[];
  professional?: string | null; // id do subdoc em Establishment.professionals
  professionalName?: string | null; // anexado pelo backend (nao ha populate de subdoc)
  // atendimento a domicilio
  address?: string; // endereco informado pelo cliente (a domicilio)
  atHome?: boolean;
  travelMinutes?: number; // deslocamento de um trecho (ida)
  travelKm?: number;
  travelFee?: number; // taxa de deslocamento (ja somada ao payment.amount)
  homeLat?: number | null; // coords do endereco do cliente
  homeLng?: number | null;
  extraMinutes?: number; // tempo extra adicionado pelo estabelecimento
  scheduledAt: string;
  endsAt: string;
  status: "pendente" | "confirmado" | "concluido" | "cancelado" | "reservado";
  attendance?: "pendente" | "presente" | "falta" | "reposicao"; // presenca (aulas)
  notes?: string;
  payment: {
    status: string;
    amount: number;
    depositRequired?: number; // sinal exigido no ato (0 = sem sinal)
    depositPaid?: boolean; // sinal ja recebido?
    depositMethod?: string;
  };
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

  // horarios livres de um servico num dia; professional opcional.
  // home: coordenadas do cliente (atendimento a domicilio) para reservar o
  // deslocamento na ocupacao dos horarios.
  // admin=true (dono/equipe autenticados): ignora a janela de dias futuros e a
  // antecedencia minima do cliente, para o estabelecimento marcar retorno/visita
  // em qualquer data futura livre.
  freeSlots: (
    serviceId: string,
    date: string,
    professional?: string | null,
    home?: { lat: number; lng: number } | null,
    admin?: boolean
  ) =>
    api
      .get<{ date: string; slots: string[] }>(`/services/${serviceId}/slots`, {
        params: {
          date,
          ...(professional ? { professional } : {}),
          ...(home ? { atHome: "true", lat: home.lat, lng: home.lng } : {}),
          ...(admin ? { admin: "true" } : {}),
        },
      })
      .then((r) => r.data),

  // horarios livres para um COMBO (varios servicos) num dia; usa a soma das
  // duracoes. establishmentId obrigatorio; professional opcional.
  comboSlots: (
    establishmentId: string,
    serviceIds: string[],
    date: string,
    professional?: string | null,
    home?: { lat: number; lng: number } | null
  ) =>
    api
      .get<{ date: string; slots: string[] }>(`/availability/combo-slots`, {
        params: {
          establishment: establishmentId,
          serviceIds: serviceIds.join(","),
          date,
          ...(professional ? { professional } : {}),
          ...(home ? { atHome: "true", lat: home.lat, lng: home.lng } : {}),
        },
      })
      .then((r) => r.data),

  createBooking: (data: {
    serviceId?: string;
    serviceIds?: string[];
    // agendamento feito pelo estabelecimento para um cliente (ex.: retorno)
    clientId?: string;
    scheduledAt: string;
    notes?: string;
    address?: string;
    professionalId?: string | null;
    clientReminderMinutes?: number | null;
    // atendimento a domicilio: endereco estruturado + coordenadas do cliente
    atHome?: boolean;
    homeAddress?: {
      country?: string;
      state: string;
      city: string;
      neighborhood?: string;
      street: string;
      number: string;
    };
    homeCoords?: { lat: number; lng: number };
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

  // o estabelecimento matricula um aluno numa serie recorrente.
  // `slots` = horarios (ISO) da 1a semana, um por dia da semana escolhido.
  createEnrollment: (data: {
    establishmentId: string;
    serviceId: string;
    clientId: string;
    professionalId?: string | null;
    slots: string[];
    weeks: number;
    notes?: string;
    address?: string;
    seriesId?: string; // informar p/ anexar aulas a uma matricula existente
  }) =>
    api
      .post<{
        seriesId: string;
        createdCount: number;
        skippedCount: number;
        created: Booking[];
        skipped: { date: string; reason: string }[];
      }>("/bookings/enrollment", data)
      .then((r) => r.data),

  cancelSeries: (seriesId: string) =>
    api
      .delete<{ message: string; cancelledCount: number }>(
        `/bookings/series/${seriesId}`
      )
      .then((r) => r.data),

  // marca a presenca do aluno numa aula (frequencia)
  markAttendance: (
    id: string,
    attendance: "pendente" | "presente" | "falta" | "reposicao"
  ) =>
    api
      .patch<Booking>(`/bookings/${id}/attendance`, { attendance })
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

  // registra (paid=true) ou estorna (paid=false) o recebimento do sinal
  markDeposit: (
    id: string,
    paid: boolean,
    method?: "dinheiro" | "cartao" | "pix" | "outro"
  ) =>
    api
      .patch<Booking>(`/bookings/${id}/deposit`, { paid, method })
      .then((r) => r.data),

  // adiciona tempo extra ao atendimento (imprevistos); ocupa a agenda
  extendBooking: (id: string, extraMinutes: number) =>
    api
      .patch<Booking>(`/bookings/${id}/extend`, { extraMinutes })
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