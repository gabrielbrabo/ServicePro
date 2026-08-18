import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { useEstablishments } from "../context/EstablishmentContext";
import { AppNotification } from "../api/notification";
import { ReviewModal } from "./ReviewModal";
import { EstablishmentReviewsModal } from "./EstablishmentReviewsModal";

const ICON: Record<AppNotification["type"], string> = {
    booking_created: "📅",
    booking_confirmed: "✓",
    booking_cancelled: "✕",
    booking_rescheduled: "🔄",
    booking_completed: "★",
    review_request: "⭐",
    review_received: "🌟",
};

const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
    });
};

export function NotificationBell() {
    const { items, unread, markAllRead, refresh } = useNotifications();
    const { establishments, select } = useEstablishments();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // agendamento a avaliar (abre o ReviewModal quando definido)
    const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
    // estabelecimento cujas avaliacoes o dono/funcionario quer ver
    const [reviewsEstId, setReviewsEstId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [open]);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next) void markAllRead();
    };

    // Clique na notificacao: leva ao lugar certo conforme o papel.
    // - review_request: abre o modal de avaliacao (cliente avalia o atendimento).
    // - Se o usuario e dono/funcionario do estabelecimento citado, vai ao painel
    //   (ja selecionando aquele estabelecimento). Senao, e cliente: vai a lista
    //   de agendamentos dele.
    const handleClick = (n: AppNotification) => {
        setOpen(false);

        // convite para avaliar (cliente) -> abre o modal de estrelas
        if (n.type === "review_request" && n.booking) {
            setReviewBookingId(n.booking);
            return;
        }

        // avaliacao recebida (dono/funcionario) -> abre a lista de avaliacoes
        if (n.type === "review_received" && n.establishment) {
            setReviewsEstId(n.establishment);
            return;
        }

        const mine = n.establishment
            ? establishments.find((e) => e._id === n.establishment)
            : undefined;

        if (mine) {
            // troca o estabelecimento E força a aba de recebidos
            select(mine, "recebidos");
            navigate("/painel");
        } else {
            navigate("/agendamentos");
        }
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={toggle}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink/60 transition hover:bg-sand hover:text-ink"
                aria-label={
                    unread > 0 ? `${unread} notificações não lidas` : "Notificações"
                }
            >
                <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>

                {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full z-40 mt-1 max-h-96 w-80 max-w-[90vw] overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-lg">
                    <div className="border-b border-ink/10 px-4 py-2.5">
                        <p className="text-sm font-semibold text-ink">Notificações</p>
                    </div>

                    {items.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-ink/50">
                            Nenhuma notificação por aqui.
                        </p>
                    ) : (
                        <div className="divide-y divide-ink/5">
                            {items.map((n) => (
                                <button
                                    key={n._id}
                                    onClick={() => handleClick(n)}
                                    className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-sand ${n.read ? "" : "bg-teal-50/50"
                                        }`}
                                >
                                    <span className="mt-0.5 shrink-0 text-base">
                                        {ICON[n.type] || "•"}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-ink">{n.title}</p>
                                        {n.body && (
                                            <p className="mt-0.5 text-sm text-ink/60">{n.body}</p>
                                        )}
                                        <p className="mt-1 text-xs text-ink/40">
                                            {timeAgo(n.createdAt)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* modal de avaliacao, aberto ao clicar numa notificacao review_request */}
            {reviewBookingId && (
                <ReviewModal
                    bookingId={reviewBookingId}
                    onClose={() => setReviewBookingId(null)}
                    onSubmitted={() => {
                        // recarrega notificacoes/contadores apos avaliar
                        refresh();
                    }}
                />
            )}

            {/* lista de avaliacoes do estabelecimento (dono/funcionario) */}
            {reviewsEstId && (
                <EstablishmentReviewsModal
                    establishmentId={reviewsEstId}
                    onClose={() => setReviewsEstId(null)}
                />
            )}
        </div>
    );
}