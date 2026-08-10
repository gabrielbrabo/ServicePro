import { Link } from "react-router-dom";
import { Establishment } from "../api/establishment";

export function EstablishmentCard({
  establishment,
}: {
  establishment: Establishment;
}) {
  return (
    <Link
      to={`/estabelecimento/${establishment._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white transition hover:border-teal-500/40 hover:shadow-sm sm:flex-row"
    >
      {/* Foto de perfil / logo — grande, ocupa a lateral (ou o topo no mobile) */}
      {establishment.photo ? (
        <img
          src={establishment.photo}
          alt={establishment.name}
          className="h-44 w-full flex-shrink-0 object-cover sm:h-auto sm:w-44"
        />
      ) : (
        <div className="flex h-44 w-full flex-shrink-0 items-center justify-center bg-teal-500/10 text-5xl font-bold text-teal-600 sm:h-auto sm:w-44">
          {establishment.name.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div>
          <span className="inline-block rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-ink/60">
            {establishment.category?.icon} {establishment.category?.name}
          </span>

          <h3 className="mt-2 font-display text-lg font-bold text-ink group-hover:text-teal-600">
            {establishment.name}
          </h3>

          {establishment.description && (
            <p className="mt-1 line-clamp-2 text-sm text-ink/50">
              {establishment.description}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-amber-500 group-hover:underline">
            Ver e agendar →
          </span>
        </div>
      </div>
    </Link>
  );
}