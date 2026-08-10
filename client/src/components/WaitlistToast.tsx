import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { onSocketReady } from "../lib/socket";
import type { Socket } from "socket.io-client";

type ToastKind = "opening" | "reserved";

interface ToastItem {
  id: string;
  kind: ToastKind;
  establishment: string;
  service: string;
  serviceTitle?: string;
  professionalName?: string | null;
  slotStart: string;
  // só em reserved
  bookingId?: string;
  expiresAt?: string;
}

let toastCounter = 0;

function fmtSlot(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WaitlistToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const navigate = useNavigate();

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.filter((o) => o.id !== id));
  }, []);

  useEffect(() => {
    let socketRef: Socket | null = null;

    const onOpening = (payload: {
      establishment: string;
      service: string;
      serviceTitle?: string;
      professionalName?: string | null;
      slotStart: string;
    }) => {
      const id = `wl_${Date.now()}_${toastCounter++}`;
      setItems((list) => [...list, { id, kind: "opening", ...payload }]);
    };

    const onReserved = (payload: {
      bookingId: string;
      establishment: string;
      service: string;
      serviceTitle?: string;
      slotStart: string;
      expiresAt: string;
    }) => {
      const id = `rs_${Date.now()}_${toastCounter++}`;
      setItems((list) => [...list, { id, kind: "reserved", ...payload }]);
    };

    const cancel = onSocketReady((socket) => {
      socketRef = socket;
      socket.on("waitlist:opening", onOpening);
      socket.on("waitlist:reserved", onReserved);

      const reattach = () => {
        socket.off("waitlist:opening", onOpening);
        socket.off("waitlist:reserved", onReserved);
        socket.on("waitlist:opening", onOpening);
        socket.on("waitlist:reserved", onReserved);
      };
      socket.on("connect", reattach);
    });

    return () => {
      cancel();
      if (socketRef) {
        socketRef.off("waitlist:opening", onOpening);
        socketRef.off("waitlist:reserved", onReserved);
      }
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((o) =>
        o.kind === "reserved" ? (
          // ---- vaga RESERVADA para o cliente (mais forte) ----
          <div
            key={o.id}
            className="rounded-2xl border-2 border-teal-500 bg-white p-4 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display font-bold text-ink">
                  Uma vaga foi reservada para você! 🎉
                </p>
                <p className="mt-1 text-sm text-ink/70">
                  {o.serviceTitle ? `${o.serviceTitle} ` : "Atendimento "}
                  em {fmtSlot(o.slotStart)}.
                </p>
                {o.expiresAt && (
                  <p className="mt-0.5 text-xs font-medium text-teal-700">
                    Confirme até {fmtHour(o.expiresAt)} ou a vaga passa para a
                    próxima pessoa.
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(o.id)}
                className="rounded-lg p-1 text-ink/40 transition hover:bg-sand"
                aria-label="Dispensar"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  navigate("/agendamentos");
                  dismiss(o.id);
                }}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                Ver reserva
              </button>
              <button
                onClick={() => dismiss(o.id)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-ink/15 px-4 text-sm font-medium text-ink/70 transition hover:bg-sand"
              >
                Depois
              </button>
            </div>
          </div>
        ) : (
          // ---- vaga ABERTA (corra para pegar) ----
          <div
            key={o.id}
            className="rounded-2xl border border-teal-500/30 bg-white p-4 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display font-bold text-ink">
                  Abriu uma vaga! 🎉
                </p>
                <p className="mt-1 text-sm text-ink/70">
                  {o.serviceTitle
                    ? `Vaga para ${o.serviceTitle}`
                    : "Vaga disponível"}
                  {o.professionalName ? ` com ${o.professionalName}` : ""} em{" "}
                  {fmtSlot(o.slotStart)}.
                </p>
                <p className="mt-0.5 text-xs text-ink/50">
                  Corra para garantir — outras pessoas também foram avisadas.
                </p>
              </div>
              <button
                onClick={() => dismiss(o.id)}
                className="rounded-lg p-1 text-ink/40 transition hover:bg-sand"
                aria-label="Dispensar"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  navigate(`/estabelecimento/${o.establishment}`);
                  dismiss(o.id);
                }}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                Agendar agora
              </button>
              <button
                onClick={() => dismiss(o.id)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-ink/15 px-4 text-sm font-medium text-ink/70 transition hover:bg-sand"
              >
                Depois
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}