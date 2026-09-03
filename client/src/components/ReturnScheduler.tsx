import { useEffect, useMemo, useState } from "react";
import { serviceApi, ServiceItem } from "../api/service";
import { professionalApi, Professional } from "../api/professional";
import { scheduleApi, Booking } from "../api/schedule";

// Agendador de RETORNO/PRÓXIMA VISITA integrado à agenda. Reutilizável por
// qualquer módulo (enfermagem, podologia, ...). Mostra só horários LIVRES e
// agenda na agenda do estabelecimento PARA o paciente (createBooking com
// clientId, tratado no backend como agendamento do estabelecimento). Lista os
// próximos e permite cancelar.
// onScheduled(iso) é chamado após agendar, com o horário (ISO) escolhido.

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

const input =
  "h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500";
const lbl = "mb-1 block text-xs font-medium text-ink/60";
const primaryBtn =
  "h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  concluido: "Concluído",
  reservado: "Reservado",
};

export function ReturnScheduler({
  establishmentId,
  clientId,
  title = "Agendar retorno",
  hint = "Escolha o serviço e a data — só aparecem horários livres na agenda. O agendamento entra direto na sua agenda.",
  onScheduled,
}: {
  establishmentId: string;
  clientId: string;
  title?: string;
  hint?: string;
  onScheduled?: (iso: string) => void;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);

  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState(""); // ISO
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);

  const loadBookings = () => {
    setLoading(true);
    scheduleApi
      .listBookings("provider", establishmentId)
      .then((list) =>
        setBookings(list.filter((b) => (b.client?._id || "") === clientId))
      )
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
    serviceApi
      .listByEstablishment(establishmentId)
      .then((list) => {
        const actives = list.filter((s) => s.active !== false);
        setServices(actives);
        if (actives[0]) setServiceId(actives[0]._id);
      })
      .catch(() => setServices([]));
    professionalApi
      .list(establishmentId)
      .then((list) => {
        setPros(list);
        if (list[0]) setProfessionalId(list[0]._id);
      })
      .catch(() => setPros([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, clientId]);

  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSlot("");
    scheduleApi
      .freeSlots(serviceId, date, professionalId || undefined, null, true)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [serviceId, date, professionalId]);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            b.status !== "cancelado" &&
            new Date(b.endsAt || b.scheduledAt).getTime() >= now
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime()
        ),
    [bookings, now]
  );

  const schedule = async () => {
    if (!serviceId || !slot) {
      setError("Escolha o serviço, a data e um horário livre.");
      return;
    }
    setBooking(true);
    setError(null);
    setOk(null);
    try {
      await scheduleApi.createBooking({
        serviceId,
        scheduledAt: slot,
        clientId,
        professionalId: professionalId || undefined,
        notes: notes.trim() || undefined,
      });
      onScheduled?.(slot);
      setOk("Agendado na agenda!");
      setNotes("");
      const usedIso = slot;
      setSlot("");
      loadBookings();
      if (serviceId && date) {
        scheduleApi
          .freeSlots(serviceId, date, professionalId || undefined, null, true)
          .then((r) => setSlots(r.slots.filter((s) => s !== usedIso)))
          .catch(() => {});
      }
      setTimeout(() => setOk(null), 3000);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      setError(
        status === 409
          ? "Esse horário não está mais disponível. Escolha outro."
          : "Não foi possível agendar."
      );
    } finally {
      setBooking(false);
    }
  };

  const cancel = async (b: Booking) => {
    const prev = bookings;
    setBookings((list) =>
      list.map((x) => (x._id === b._id ? { ...x, status: "cancelado" } : x))
    );
    try {
      await scheduleApi.updateStatus(b._id, "cancelado");
    } catch {
      setBookings(prev);
      setError("Não foi possível cancelar.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-display font-bold text-ink">{title}</h3>
        <p className="mt-1 text-xs text-ink/50">{hint}</p>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-3 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
            {ok}
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Serviço</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={input}
            >
              {services.length === 0 && (
                <option value="">Nenhum serviço cadastrado</option>
              )}
              {services.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          {pros.length > 0 && (
            <label className="block">
              <span className={lbl}>Profissional</span>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className={input}
              >
                {pros.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className={lbl}>Data</span>
            <input
              type="date"
              value={date}
              min={toDateInput(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={lbl}>Horário livre</span>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              disabled={!serviceId || !date || slotsLoading}
              className={input}
            >
              {!date ? (
                <option value="">Escolha a data</option>
              ) : slotsLoading ? (
                <option value="">Carregando horários...</option>
              ) : slots.length === 0 ? (
                <option value="">Sem horários livres nesta data</option>
              ) : (
                <>
                  <option value="">Selecione...</option>
                  {slots.map((iso) => (
                    <option key={iso} value={iso}>
                      {hhmm(iso)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className={lbl}>Observação (opcional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: retorno para reavaliação"
            className={input}
          />
        </label>
        <div className="mt-3">
          <button
            onClick={schedule}
            disabled={booking || !slot}
            className={primaryBtn}
          >
            {booking ? "Agendando..." : "Agendar na agenda"}
          </button>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-display font-bold text-ink">
          Próximos agendamentos
        </h4>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-ink/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
            Carregando...
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
            Nenhum agendamento futuro.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div
                key={b._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white p-4"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {fmtDateTime(b.scheduledAt)}
                  </p>
                  <p className="text-xs text-ink/50">
                    {b.service?.title}
                    {b.professionalName ? ` · ${b.professionalName}` : ""} ·{" "}
                    <span className="font-medium text-ink/60">
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => cancel(b)}
                  className="text-sm font-medium text-red-500 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
