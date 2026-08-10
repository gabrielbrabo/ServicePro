import { Booking } from "../api/schedule";
import { formatDateShort, formatTime, formatPrice } from "../lib/time";
import { Avatar } from "./Avatar";
import { EstablishmentAvatar } from "./EstablishmentAvatar";
import { MiniMap } from "./MiniMap";

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

// endereco completo em uma linha
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
  const l1 = [addr.street, addr.number].filter(Boolean).join(", ");
  const l2 = [addr.neighborhood, addr.city, addr.state]
    .filter(Boolean)
    .join(" · ");
  return [l1, l2].filter(Boolean).join(" — ");
}

// linha rotulo/valor reutilizavel
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink/80">{value}</dd>
    </div>
  );
}

export function BookingDetailModal({
  booking,
  role,
  onClose,
}: {
  booking: Booking;
  role: "client" | "provider";
  onClose: () => void;
}) {
  const b = booking;
  const isClient = role === "client";

  // coordenadas: no banco vem [lon, lat] (GeoJSON). Inverte para o mapa.
  const coords = b.establishment?.location?.coordinates;
  const hasCoords =
    Array.isArray(coords) &&
    coords.length === 2 &&
    (coords[0] !== 0 || coords[1] !== 0);
  const lon = hasCoords ? coords![0] : 0;
  const lat = hasCoords ? coords![1] : 0;

  const durationLabel = b.service?.durationMinutes
    ? `${b.service.durationMinutes} min`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 p-5">
          <div className="flex min-w-0 items-center gap-3">
            {isClient ? (
              <EstablishmentAvatar
                name={b.establishment?.name || "?"}
                src={b.establishment?.photo}
                size={52}
              />
            ) : (
              <Avatar
                name={b.client?.name || "?"}
                src={b.client?.avatar}
                size={52}
              />
            )}
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-ink">
                {isClient ? b.establishment?.name : b.client?.name}
              </h2>
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[b.status]}`}
              >
                {STATUS_LABEL[b.status]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Corpo (rolavel) */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Serviço */}
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              {b.service?.title}
            </h3>
            {b.service?.description && (
              <p className="mt-1 text-sm leading-relaxed text-ink/70">
                {b.service.description}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4">
            <Row
              label="Data e hora"
              value={`${formatDateShort(b.scheduledAt)} às ${formatTime(
                b.scheduledAt
              )}`}
            />
            {durationLabel && <Row label="Duração" value={durationLabel} />}
            <Row label="Valor" value={formatPrice(b.payment?.amount ?? 0)} />
            {b.professionalName && (
              <Row label="Profissional" value={b.professionalName} />
            )}
          </dl>

          {/* Observacoes do cliente (util principalmente para o funcionario) */}
          {b.notes && (
            <div className="rounded-xl bg-sand/50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                Observações
              </p>
              <p className="mt-1 text-sm text-ink/80">{b.notes}</p>
            </div>
          )}

          {/* Lado CLIENTE: endereco + mapa do estabelecimento */}
          {isClient && (
            <>
              {b.establishment?.address && (
                <Row
                  label="Endereço"
                  value={formatAddress(b.establishment.address)}
                />
              )}
              {b.establishment?.phone && (
                <Row label="Telefone" value={b.establishment.phone} />
              )}
              {hasCoords ? (
                <MiniMap
                  lat={lat}
                  lon={lon}
                  label={`Localização de ${b.establishment?.name || ""}`}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-ink/20 px-4 py-3 text-center text-sm text-ink/50">
                  Localização no mapa indisponível.
                </p>
              )}
            </>
          )}

          {/* Lado FUNCIONARIO: contato do cliente */}
          {!isClient && b.client?.phone && (
            <Row label="Telefone do cliente" value={b.client.phone} />
          )}
        </div>
      </div>
    </div>
  );
}