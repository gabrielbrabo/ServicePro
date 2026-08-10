import { useEffect, useState, useCallback } from "react";
import { scheduleApi, Booking } from "../api/schedule";
import { formatDateShort, formatTime, formatPrice } from "../lib/time";
import { ensureSocket } from "../lib/socket";
import { RescheduleModal } from "./RescheduleModal";
import { ReminderModal } from "./ReminderModal";
import { Avatar } from "./Avatar";
import { EstablishmentAvatar } from "./EstablishmentAvatar";
import { BookingDetailModal } from "./BookingDetailModal";
import { useNotifications } from "../context/NotificationContext";

const STATUS_LABEL: Record<Booking["status"], string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  reservado: "Reserva aguardando",
};

const STATUS_STYLE: Record<Booking["status"], string> = {
  pendente: "bg-amber-400/20 text-amber-600",
  confirmado: "bg-teal-50 text-teal-600",
  concluido: "bg-ink/10 text-ink/60",
  cancelado: "bg-red-50 text-red-600",
  reservado: "bg-teal-500/20 text-teal-700",
};

// pontinho colorido ao lado do status, para leitura rapida
const STATUS_DOT: Record<Booking["status"], string> = {
  pendente: "bg-amber-500",
  confirmado: "bg-teal-500",
  concluido: "bg-ink/40",
  cancelado: "bg-red-500",
  reservado: "bg-teal-600",
};

// ordem: ativos primeiro, depois concluidos, por ultimo cancelados
const STATUS_RANK: Record<Booking["status"], number> = {
  pendente: 0,
  confirmado: 0,
  reservado: 0,
  concluido: 1,
  cancelado: 2,
};

type PaymentMethod = "dinheiro" | "cartao" | "pix" | "outro";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "pix", label: "Pix" },
  { value: "outro", label: "Outro" },
];

// tempo restante em "MM:SS" ou "HH:MM:SS"
function formatRemaining(ms: number): string {
  if (ms <= 0) return "expirado";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// monta o endereco completo em uma linha, a partir do address do estabelecimento
function formatAddress(
  addr?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  } | null
): string {
  if (!addr) return "";
  const linha1 = [addr.street, addr.number].filter(Boolean).join(", ");
  const linha2 = [addr.neighborhood, addr.city, addr.state]
    .filter(Boolean)
    .join(" · ");
  return [linha1, linha2].filter(Boolean).join(" — ");
}

export function BookingList({
  role,
  establishmentId,
}: {
  role: "client" | "provider";
  establishmentId?: string;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  // modal de detalhes (abre ao clicar no card)
  const [detail, setDetail] = useState<Booking | null>(null);

  const [completing, setCompleting] = useState<Booking | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("dinheiro");
  const [savingComplete, setSavingComplete] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // confirmacao com escolha da antecedencia do lembrete do estabelecimento
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const [ownerReminder, setOwnerReminder] = useState<number>(30);
  const [savingConfirm, setSavingConfirm] = useState(false);

  // ações de reserva
  const [actingReservation, setActingReservation] = useState<string | null>(
    null
  );
  const [reservationError, setReservationError] = useState<string | null>(null);

  // relógio para o contador regressivo
  const [now, setNow] = useState(() => Date.now());

  // atualiza contadores do sininho e das abas apos qualquer acao
  const { refresh: refreshBadges, bookingsVersion } = useNotifications();

  const load = useCallback(() => {
    setLoading(true);
    scheduleApi
      .listBookings(role, establishmentId)
      .then(setBookings)
      .finally(() => setLoading(false));
  }, [role, establishmentId]);

  useEffect(load, [load]);

  useEffect(() => {
    const refresh = () => {
      load();
    };

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    const bind = () => {
      if (cancelled) return;
      const socket = ensureSocket(); // cria a conexao se ainda nao existir

      if (!socket) {
        // sem token/sessao ainda: tenta de novo em breve
        const t = setTimeout(bind, 500);
        cleanup = () => clearTimeout(t);
        return;
      }

      socket.on("booking:new", refresh);
      socket.on("booking:updated", refresh);
      socket.on("booking:rescheduled", refresh);
      socket.on("waitlist:reserved", refresh);

      cleanup = () => {
        socket.off("booking:new", refresh);
        socket.off("booking:updated", refresh);
        socket.off("booking:rescheduled", refresh);
        socket.off("waitlist:reserved", refresh);
      };
    };

    bind();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [load, role]);

  // separa as reservas aguardando resposta (só fazem sentido para o cliente)
  const reservations = bookings.filter((b) => b.status === "reservado");

  // regulares: ativos primeiro, depois concluidos, por ultimo cancelados;
  // dentro de cada bloco, data do mais novo ao mais antigo
  const regular = bookings
    .filter((b) => b.status !== "reservado")
    .sort((a, b) => {
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (rank !== 0) return rank;
      return (
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      );
    });

  // tique do contador só enquanto houver reserva ativa
  useEffect(() => {
    if (reservations.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [reservations.length]);

  // recarrega quando o contexto detecta um evento de agendamento.
  // Isso cobre o caso do socket local nao ter registrado o listener a tempo.
  useEffect(() => {
    if (bookingsVersion > 0) load();
  }, [bookingsVersion, load]);

  const changeStatus = async (id: string, status: Booking["status"]) => {
    const updated = await scheduleApi.updateStatus(id, status);
    setBookings((b) => b.map((x) => (x._id === id ? updated : x)));
    refreshBadges();
  };

  // abre o modal de lembrete antes de confirmar (quem confirma escolhe a
  // antecedencia do aviso do estabelecimento, igual o cliente faz ao agendar)
  const startConfirm = (b: Booking) => {
    setConfirming(b);
    setOwnerReminder(30);
  };

  const confirmBooking = async () => {
    if (!confirming) return;
    setSavingConfirm(true);
    try {
      const updated = await scheduleApi.updateStatus(
        confirming._id,
        "confirmado",
        undefined,
        ownerReminder
      );
      setBookings((b) =>
        b.map((x) => (x._id === confirming._id ? updated : x))
      );
      setConfirming(null);
      refreshBadges();
    } finally {
      setSavingConfirm(false);
    }
  };

  const handleRescheduled = (updated: Booking) => {
    setBookings((b) => b.map((x) => (x._id === updated._id ? updated : x)));
    setRescheduling(null);
    refreshBadges();
  };

  const startComplete = (b: Booking) => {
    setCompleting(b);
    setMethod("dinheiro");
    setCompleteError(null);
  };

  const confirmComplete = async () => {
    if (!completing) return;
    setSavingComplete(true);
    setCompleteError(null);
    try {
      const updated = await scheduleApi.updateStatus(
        completing._id,
        "concluido",
        method
      );
      setBookings((b) =>
        b.map((x) => (x._id === completing._id ? updated : x))
      );
      setCompleting(null);
      refreshBadges();
    } catch {
      setCompleteError("Não foi possível concluir. Tente novamente.");
    } finally {
      setSavingComplete(false);
    }
  };

  const acceptReservation = async (id: string) => {
    setActingReservation(id);
    setReservationError(null);
    try {
      const updated = await scheduleApi.acceptReservation(id);
      setBookings((b) => b.map((x) => (x._id === id ? updated : x)));
      refreshBadges();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setReservationError(
        status === 409
          ? "O prazo desta reserva expirou."
          : "Não foi possível aceitar a reserva."
      );
      load();
    } finally {
      setActingReservation(null);
    }
  };

  const declineReservation = async (id: string) => {
    setActingReservation(id);
    setReservationError(null);
    try {
      const updated = await scheduleApi.declineReservation(id);
      setBookings((b) => b.map((x) => (x._id === id ? updated : x)));
      refreshBadges();
    } catch {
      setReservationError("Não foi possível recusar a reserva.");
      load();
    } finally {
      setActingReservation(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-ink/10 bg-white"
          />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 bg-white p-12 text-center">
        <p className="text-ink/50">
          {role === "client"
            ? "Você ainda não agendou nenhum serviço."
            : "Você ainda não recebeu agendamentos."}
        </p>
      </div>
    );
  }

  return (
    <>
      {reservationError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {reservationError}
        </div>
      )}

      {/* RESERVAS AGUARDANDO RESPOSTA (destacadas no topo) */}
      {reservations.length > 0 && (
        <div className="mb-6 space-y-3">
          {reservations.map((b) => {
            const expiresAt = b.reservationExpiresAt
              ? new Date(b.reservationExpiresAt).getTime()
              : 0;
            const remaining = expiresAt - now;
            const expired = remaining <= 0;
            const acting = actingReservation === b._id;

            return (
              <div
                key={b._id}
                className="rounded-2xl border-2 border-teal-500/40 bg-teal-500/5 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-600" />
                        Vaga reservada para você
                      </span>
                    </div>
                    <h3 className="mt-2 font-display font-bold text-ink">
                      {b.service?.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-ink/70">
                      {formatDateShort(b.scheduledAt)} às{" "}
                      {formatTime(b.scheduledAt)} · {b.establishment?.name}
                    </p>
                    {b.professionalName && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink/60">
                        <svg
                          className="h-4 w-4 text-ink/40"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                            clipRule="evenodd"
                          />
                        </svg>
                        com {b.professionalName}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm font-medium text-teal-600">
                      {formatPrice(b.payment?.amount ?? 0)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-ink/50">
                      {expired ? "Prazo encerrado" : "Confirme em"}
                    </p>
                    <p
                      className={`font-mono text-lg font-bold ${expired
                        ? "text-red-600"
                        : remaining < 5 * 60 * 1000
                          ? "text-red-600"
                          : "text-teal-700"
                        }`}
                    >
                      {formatRemaining(remaining)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-ink/60">
                  Abriu uma vaga da lista de espera e ela foi reservada para
                  você. Se não confirmar a tempo, a vaga passa para a próxima
                  pessoa.
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => acceptReservation(b._id)}
                    disabled={acting || expired}
                    className="h-11 flex-1 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
                  >
                    {acting ? "..." : "Quero esta vaga"}
                  </button>
                  <button
                    onClick={() => declineReservation(b._id)}
                    disabled={acting}
                    className="h-11 rounded-xl border border-ink/15 px-5 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-50"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AGENDAMENTOS NORMAIS */}
      <div className="space-y-3">
        {regular.map((b) => {
          const closed = b.status === "concluido" || b.status === "cancelado";
          return (
            <div
              key={b._id}
              onClick={() => setDetail(b)}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5 transition cursor-pointer ${closed
                ? "border-ink/10 opacity-75"
                : "border-ink/10 hover:border-teal-500/30 hover:shadow-sm"
                }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                {/* foto: estabelecimento (cliente) ou cliente (funcionario) */}
                {role === "client" ? (
                  <EstablishmentAvatar
                    name={b.establishment?.name || "?"}
                    src={b.establishment?.photo}
                    size={48}
                    className="mt-0.5"
                  />
                ) : (
                  <Avatar
                    name={b.client?.name || "?"}
                    src={b.client?.avatar}
                    size={48}
                    className="mt-0.5"
                  />
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-bold text-ink">
                      {b.service?.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[b.status]
                        }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[b.status]
                          }`}
                      />
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>

                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/60">
                    <svg
                      className="h-4 w-4 text-ink/40"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {formatDateShort(b.scheduledAt)} às {formatTime(b.scheduledAt)}
                  </p>

                  <p className="mt-0.5 text-sm font-medium text-ink/80">
                    {role === "client" ? b.establishment?.name : b.client?.name}
                  </p>

                  {/* endereco completo — so no lado do cliente */}
                  {role === "client" && b.establishment?.address && (
                    <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink/55">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-ink/40"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="min-w-0">
                        {formatAddress(b.establishment.address)}
                      </span>
                    </p>
                  )}

                  {b.professionalName && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink/60">
                      <svg
                        className="h-4 w-4 text-ink/40"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                      com {b.professionalName}
                    </p>
                  )}

                  <p className="mt-1 text-sm font-semibold text-teal-600">
                    {formatPrice(b.payment?.amount ?? 0)}
                  </p>
                </div>
              </div>

              <div
                className="flex flex-wrap gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {role === "provider" && b.status === "pendente" && (
                  <button
                    onClick={() => startConfirm(b)}
                    className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-600"
                  >
                    Confirmar
                  </button>
                )}
                {role === "provider" && b.status === "confirmado" && (
                  <button
                    onClick={() => startComplete(b)}
                    className="rounded-lg bg-ink/80 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-ink"
                  >
                    Concluir
                  </button>
                )}
                {(b.status === "pendente" || b.status === "confirmado") && (
                  <button
                    onClick={() => setRescheduling(b)}
                    className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
                  >
                    Reagendar
                  </button>
                )}
                {(b.status === "pendente" || b.status === "confirmado") && (
                  <button
                    onClick={() => changeStatus(b._id, "cancelado")}
                    className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {rescheduling && (
        <RescheduleModal
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onRescheduled={handleRescheduled}
        />
      )}

      {detail && (
        <BookingDetailModal
          booking={detail}
          role={role}
          onClose={() => setDetail(null)}
        />
      )}

      {/* Modal: antecedencia do lembrete do estabelecimento ao confirmar */}
      {confirming && (
        <ReminderModal
          value={ownerReminder}
          onChange={setOwnerReminder}
          onConfirm={confirmBooking}
          onCancel={() => {
            if (!savingConfirm) setConfirming(null);
          }}
          saving={savingConfirm}
          confirmLabel="Confirmar agendamento"
        />
      )}

      {/* Mini-modal: forma de pagamento ao concluir */}
      {completing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => !savingComplete && setCompleting(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-ink">
              Concluir atendimento
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {completing.service?.title} ·{" "}
              {formatPrice(completing.payment?.amount ?? 0)}
            </p>

            <p className="mt-4 mb-2 text-sm font-medium text-ink/70">
              Forma de pagamento
            </p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${method === m.value
                    ? "border-teal-500 bg-teal-500 text-white"
                    : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {completeError && (
              <p className="mt-3 text-sm font-medium text-red-500">
                {completeError}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={confirmComplete}
                disabled={savingComplete}
                className="h-11 flex-1 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {savingComplete ? "Concluindo..." : "Concluir"}
              </button>
              <button
                onClick={() => setCompleting(null)}
                disabled={savingComplete}
                className="h-11 rounded-xl border border-ink/15 px-5 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}