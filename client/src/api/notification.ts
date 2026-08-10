import { api } from "../lib/api";

export type NotificationType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_completed";

export interface AppNotification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  body: string;
  booking: string | null;
  establishment: string | null;
  read: boolean;
  createdAt: string;
}

export interface Badges {
  clientPending: number;
  byEstablishment: Record<string, number>;
}

export const notificationApi = {
  list: (limit = 20) =>
    api
      .get<{ items: AppNotification[]; unread: number }>("/notifications", {
        params: { limit },
      })
      .then((r) => r.data),

  markAllRead: () =>
    api
      .patch<{ message: string; unread: number }>("/notifications/read")
      .then((r) => r.data),

  badges: () =>
    api.get<Badges>("/notifications/badges").then((r) => r.data),

  // cliente abriu a lista: zera o badge dele
  markBookingsSeen: () =>
    api
      .patch<{ message: string }>("/notifications/bookings-seen")
      .then((r) => r.data),
};