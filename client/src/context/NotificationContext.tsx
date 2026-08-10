import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    ReactNode,
  } from "react";
  import {
    notificationApi,
    AppNotification,
    Badges,
  } from "../api/notification";
  import { useAuth } from "./AuthContext";
  import { getSocket } from "../lib/socket";
  
  interface NotificationCtx {
    items: AppNotification[];
    unread: number;
    badges: Badges;
    bookingsVersion: number; // muda a cada evento de agendamento
    refresh: () => void;
    markAllRead: () => Promise<void>;
    markBookingsSeen: () => Promise<void>;
  }
  
  const empty: Badges = { clientPending: 0, byEstablishment: {} };
  
  const Ctx = createContext<NotificationCtx | null>(null);
  
  export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [items, setItems] = useState<AppNotification[]>([]);
    const [unread, setUnread] = useState(0);
    const [badges, setBadges] = useState<Badges>(empty);
    const [bookingsVersion, setBookingsVersion] = useState(0);
  
    const refresh = useCallback(() => {
      if (!user) return;
      notificationApi
        .list()
        .then((res) => {
          setItems(res.items);
          setUnread(res.unread);
        })
        .catch(() => {
          /* silencioso: notificacao nao pode quebrar a tela */
        });
      notificationApi
        .badges()
        .then(setBadges)
        .catch(() => {
          /* idem */
        });
    }, [user]);
  
    // carrega ao logar; limpa ao deslogar
    useEffect(() => {
      if (!user) {
        setItems([]);
        setUnread(0);
        setBadges(empty);
        return;
      }
      refresh();
    }, [user?.id, refresh]);
  
    // tempo real: qualquer evento relevante recarrega os contadores
    useEffect(() => {
      if (!user) return;
      const socket = getSocket();
      if (!socket) return;
  
      const onNotification = () => refresh();
      const onBooking = () => {
        refresh();
        setBookingsVersion((v) => v + 1); // sinaliza para quem lista agendamentos
      };
  
      socket.on("notification:new", onNotification);
      socket.on("booking:new", onBooking);
      socket.on("booking:updated", onBooking);
      socket.on("booking:rescheduled", onBooking);
      socket.on("waitlist:reserved", onBooking);
  
      return () => {
        socket.off("notification:new", onNotification);
        socket.off("booking:new", onBooking);
        socket.off("booking:updated", onBooking);
        socket.off("booking:rescheduled", onBooking);
        socket.off("waitlist:reserved", onBooking);
      };
    }, [user, refresh]);
  
    const markAllRead = useCallback(async () => {
      if (unread === 0) return;
      // otimista: some na hora
      setItems((list) => list.map((n) => ({ ...n, read: true })));
      setUnread(0);
      try {
        await notificationApi.markAllRead();
      } catch {
        refresh(); // reverte buscando o estado real
      }
    }, [unread, refresh]);
  
    const markBookingsSeen = useCallback(async () => {
      if (badges.clientPending === 0) return;
      setBadges((b) => ({ ...b, clientPending: 0 }));
      try {
        await notificationApi.markBookingsSeen();
      } catch {
        refresh();
      }
    }, [badges.clientPending, refresh]);
  
    return (
      <Ctx.Provider
        value={{
          items,
          unread,
          badges,
          bookingsVersion,
          refresh,
          markAllRead,
          markBookingsSeen,
        }}
      >
        {children}
      </Ctx.Provider>
    );
  }
  
  export function useNotifications(): NotificationCtx {
    const ctx = useContext(Ctx);
    if (!ctx) {
      throw new Error(
        "useNotifications deve ser usado dentro de NotificationProvider"
      );
    }
    return ctx;
  }