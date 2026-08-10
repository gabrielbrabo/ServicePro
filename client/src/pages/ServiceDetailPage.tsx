import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "../components/NavBar";
import { catalogApi, Service } from "../api/catalog";
import { scheduleApi } from "../api/schedule";
import {
  formatPrice,
  formatTime,
  nextDays,
  toDateInput,
  DAYS_SHORT,
} from "../lib/time";
import { AxiosError } from "axios";

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const days = nextDays(14);

  useEffect(() => {
    if (id) catalogApi.getService(id).then(setService);
  }, [id]);

  // busca horários livres sempre que muda o dia
  useEffect(() => {
    if (!id) return;
    setLoadingSlots(true);
    setChosen(null);
    scheduleApi
      .freeSlots(id, toDateInput(selectedDate))
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [id, selectedDate]);

  const confirm = async () => {
    if (!id || !chosen) return;
    setBooking(true);
    setError("");
    try {
      await scheduleApi.createBooking({ serviceId: id, scheduledAt: chosen });
      setDone(true);
      setTimeout(() => navigate("/agendamentos"), 1500);
    } catch (err) {
      const ax = err as AxiosError<{ message: string }>;
      setError(ax.response?.data?.message || "Não foi possível agendar");
    } finally {
      setBooking(false);
    }
  };

  if (!service) {
    return (
      <PageContainer>
        <p className="text-ink/50">Carregando...</p>
      </PageContainer>
    );
  }

  if (done) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-md rounded-2xl border border-teal-500/30 bg-teal-50 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-500 text-2xl text-white">
            ✓
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">
            Horário agendado!
          </h2>
          <p className="mt-2 text-ink/60">
            Levando você para seus agendamentos...
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Cabeçalho do serviço */}
      <div className="rounded-2xl border border-ink/10 bg-white p-6">
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-ink/60">
          {service.category?.icon} {service.category?.name}
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">
          {service.title}
        </h1>
        <p className="mt-1 text-ink/60">
          {service.establishment?.name}
        </p>
        {service.description && (
          <p className="mt-3 text-ink/70">{service.description}</p>
        )}
        <div className="mt-4 flex items-center gap-4">
          <span className="font-display text-2xl font-bold text-teal-600">
            {formatPrice(service.price)}
          </span>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-600">
            {service.durationMinutes} min
          </span>
        </div>
      </div>

      {/* Seletor de dia */}
      <h2 className="mt-8 font-display text-xl font-bold text-ink">
        Escolha o dia
      </h2>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => {
          const active = toDateInput(d) === toDateInput(selectedDate);
          return (
            <button
              key={d.toISOString()}
              onClick={() => setSelectedDate(d)}
              className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition ${
                active
                  ? "border-teal-500 bg-teal-500 text-white"
                  : "border-ink/10 bg-white text-ink hover:border-teal-500/40"
              }`}
            >
              <span className="text-xs opacity-70">
                {DAYS_SHORT[d.getDay()]}
              </span>
              <span className="font-display text-lg font-bold">
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Seletor de horário */}
      <h2 className="mt-8 font-display text-xl font-bold text-ink">
        Horários livres
      </h2>
      <div className="mt-3">
        {loadingSlots ? (
          <p className="text-ink/50">Buscando horários...</p>
        ) : slots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
            Sem horários livres neste dia. Tente outra data.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {slots.map((iso) => {
              const active = chosen === iso;
              return (
                <button
                  key={iso}
                  onClick={() => setChosen(iso)}
                  className={`rounded-xl border py-3 text-sm font-semibold transition ${
                    active
                      ? "border-teal-500 bg-teal-500 text-white"
                      : "border-ink/10 bg-white text-ink hover:border-teal-500/40"
                  }`}
                >
                  {formatTime(iso)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmar */}
      {chosen && (
        <div className="sticky bottom-4 mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-lg">
            <p className="text-sm text-ink/70">
              Agendar <strong className="text-ink">{service.title}</strong> às{" "}
              <strong className="text-ink">{formatTime(chosen)}</strong>
            </p>
            <button
              onClick={confirm}
              disabled={booking}
              className="rounded-xl bg-teal-500 px-6 py-3 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {booking ? "Agendando..." : "Confirmar agendamento"}
            </button>
          </div>
          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </PageContainer>
  );
}
