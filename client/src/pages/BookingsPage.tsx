import { useEffect } from "react";
import { PageContainer } from "../components/NavBar";
import { BookingList } from "../components/BookingList";
import { useNotifications } from "../context/NotificationContext";

export function BookingsPage() {
  const { markBookingsSeen } = useNotifications();

  // abrir a pagina zera o badge do cliente
  useEffect(() => {
    void markBookingsSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer>
      <h1 className="font-display text-3xl font-bold text-ink">
        Meus agendamentos
      </h1>
      <p className="mt-1 text-ink/60">Os serviços que você marcou.</p>

      <div className="mt-6">
        <BookingList role="client" />
      </div>
    </PageContainer>
  );
}