import { Link } from "react-router-dom";
import { Service } from "../api/catalog";
import { formatPrice } from "../lib/time";

export function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      to={`/servico/${service._id}`}
      className="group flex flex-col rounded-2xl border border-ink/10 bg-white p-5 transition hover:border-teal-500/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-ink/60">
          {service.category?.icon} {service.category?.name}
        </span>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-600">
          {service.durationMinutes} min
        </span>
      </div>

      <h3 className="mt-3 font-display text-lg font-bold text-ink group-hover:text-teal-600">
        {service.title}
      </h3>
      <p className="mt-1 text-sm text-ink/60">
        {service.establishment?.name}
      </p>

      {service.description && (
        <p className="mt-2 line-clamp-2 text-sm text-ink/50">
          {service.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="font-display text-lg font-bold text-teal-600">
          {formatPrice(service.price)}
        </span>
        <span className="text-sm font-semibold text-amber-500 group-hover:underline">
          Agendar →
        </span>
      </div>
      {service.establishment?.city && (
        <p className="mt-2 text-xs text-ink/40">
          {service.establishment.city}
        </p>
      )}
    </Link>
  );
}
