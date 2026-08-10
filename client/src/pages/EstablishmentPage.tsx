import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../components/NavBar";
import { establishmentApi, Establishment } from "../api/establishment";
import { BookingModal } from "../components/BookingModal";
import { GallerySection } from "../components/GallerySection";
import { EstablishmentProfileHeader } from "../components/EstablishmentProfileHeader";

export function EstablishmentPage() {
  const { id = "" } = useParams();
  const [est, setEst] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    establishmentApi
      .getById(id)
      .then(setEst)
      .catch(() => setError("Não foi possível carregar o estabelecimento."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center gap-3 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando...
        </div>
      </PageContainer>
    );
  }

  if (error || !est) {
    return (
      <PageContainer>
        <div className="rounded-2xl border border-dashed border-ink/20 p-12 text-center text-ink/50">
          {error || "Estabelecimento não encontrado."}
        </div>
      </PageContainer>
    );
  }

  // endereco completo (linha separada abaixo da cidade/estado)
  const addressLine = est.address
    ? [
        est.address.street,
        est.address.number,
        est.address.neighborhood,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <PageContainer>
      {/* Perfil de apresentação do estabelecimento */}
      <EstablishmentProfileHeader
        establishmentId={est._id}
        name={est.name}
        categoryIcon={est.category?.icon}
        categoryName={est.category?.name}
        city={est.address?.city}
        state={est.address?.state}
        addressLine={addressLine}
        description={est.description}
        initialPhoto={est.photo}
        initialCovers={est.coverPhotos ?? []}
      >
        <button
          onClick={() => setBookingOpen(true)}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-8 font-semibold text-white shadow-sm transition hover:bg-teal-600 sm:w-auto"
        >
          Agendar horário
        </button>
      </EstablishmentProfileHeader>

      {/* Serviços (prévia — o agendamento acontece no modal) */}
      {est.services && est.services.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-ink">
              Serviços
            </h2>
            <span className="text-sm text-ink/40">
              {est.services.length} disponíve
              {est.services.length !== 1 ? "is" : "l"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {est.services.map((s) => (
              <button
                key={s._id}
                onClick={() => setBookingOpen(true)}
                className="group flex items-start justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-5 text-left transition hover:border-teal-500/40 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink group-hover:text-teal-600">
                    {s.title}
                  </h3>
                  {s.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink/50">
                      {s.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs font-medium text-ink/40">
                    ⏱ {s.durationMinutes} min
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold text-ink">
                    R$ {s.price.toFixed(2)}
                  </p>
                  <span className="mt-1 inline-block text-xs font-semibold text-amber-500 group-hover:underline">
                    Agendar →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Galeria antes/depois — some sozinha se não houver itens */}
      {id && <GallerySection establishmentId={id} />}

      {bookingOpen && (
        <BookingModal
          establishment={est}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </PageContainer>
  );
}