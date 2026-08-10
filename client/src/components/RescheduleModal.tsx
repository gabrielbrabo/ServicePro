import { useEffect, useMemo, useState } from "react";
import { scheduleApi, Booking } from "../api/schedule";

// monta "YYYY-MM-DD" a partir da data LOCAL (sem converter para UTC)
function toLocalYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// gera os próximos N dias como opções de data (YYYY-MM-DD + rótulo amigável)
function nextDays(count: number) {
  const out: { value: string; weekday: string; day: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      value: toLocalYMD(d),
      weekday: d.toLocaleDateString("pt-BR", { weekday: "short" }),
      day: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    });
  }
  return out;
}

// formata um ISO para HH:mm local
function slotLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RescheduleModal({
  booking,
  onClose,
  onRescheduled,
}: {
  booking: Booking;
  onClose: () => void;
  onRescheduled: (updated: Booking) => void;
}) {
  const [maxFutureDays, setMaxFutureDays] = useState(30);
  const [date, setDate] = useState<string>(toLocalYMD(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => nextDays(maxFutureDays + 1), [maxFutureDays]);

  // busca a agenda do estabelecimento para saber maxFutureDays
  useEffect(() => {
    scheduleApi
      .getAvailability(
        booking.establishment._id,
        booking.professional ?? undefined
      )
      .then((a) => {
        if (a?.maxFutureDays) setMaxFutureDays(a.maxFutureDays);
      })
      .catch(() => {
        /* mantém o padrão de 30 se falhar */
      });
  }, [booking.establishment._id, booking.professional]);

  // busca horários livres do serviço na data escolhida
  useEffect(() => {
    if (!date) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setError(null);
    // passa o profissional do agendamento: a agenda e por profissional, entao
    // sem isso o backend busca a agenda geral (professional=null) e nao acha
    // horarios — era a causa de "nenhum horario disponivel" ao reagendar.
    scheduleApi
      .freeSlots(booking.service._id, date, booking.professional ?? undefined)
      .then((res) => setSlots(res.slots))
      .catch(() => setError("Não foi possível carregar os horários."))
      .finally(() => setLoadingSlots(false));
  }, [booking.service._id, date, booking.professional]);

  const confirm = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await scheduleApi.reschedule(booking._id, selectedSlot);
      onRescheduled(updated);
    } catch {
      setError("Não foi possível reagendar. Tente outro horário.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-ink/10 p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Reagendar</h2>
            <p className="text-sm text-ink/50">
              {booking.service.title} · {booking.establishment.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-5">
            {/* aviso: reagendar volta para pendente */}
            <div className="rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-700">
              Ao reagendar, o agendamento volta para{" "}
              <strong>pendente</strong> e precisará ser confirmado novamente.
            </div>

            {/* Data */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Nova data
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((d) => {
                  const active = d.value === date;
                  return (
                    <button
                      key={d.value}
                      onClick={() => setDate(d.value)}
                      className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition ${
                        active
                          ? "border-teal-500 bg-teal-500 text-white"
                          : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                      }`}
                    >
                      <span className="text-xs capitalize">{d.weekday}</span>
                      <span className="text-sm font-semibold capitalize">
                        {d.day}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horários */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Novo horário
              </label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 py-6 text-ink/50">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
                  Buscando horários...
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
                  Nenhum horário disponível nesta data.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {slots.map((iso) => {
                    const active = iso === selectedSlot;
                    return (
                      <button
                        key={iso}
                        onClick={() => setSelectedSlot(iso)}
                        className={`rounded-lg border py-2 text-sm font-medium transition ${
                          active
                            ? "border-teal-500 bg-teal-500 text-white"
                            : "border-ink/15 bg-white text-ink/80 hover:border-teal-500"
                        }`}
                      >
                        {slotLabel(iso)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm font-medium text-red-500">{error}</p>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="border-t border-ink/10 p-5">
          {selectedSlot && (
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-ink/60">
                Novo horário ·{" "}
                <span className="capitalize">
                  {days.find((d) => d.value === date)?.day}
                </span>{" "}
                às {slotLabel(selectedSlot)}
              </span>
            </div>
          )}
          <button
            onClick={confirm}
            disabled={!selectedSlot || saving}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? "Reagendando..." : "Confirmar reagendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}