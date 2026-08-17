import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../components/NavBar";
import { establishmentApi, Establishment } from "../api/establishment";
import { serviceApi, ServiceItem } from "../api/service";
import { BookingModal } from "../components/BookingModal";
import { GallerySection } from "../components/GallerySection";
import { EstablishmentProfileHeader } from "../components/EstablishmentProfileHeader";

export function EstablishmentPage() {
  const { id = "" } = useParams();
  const [est, setEst] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  // servico escolhido no carrossel (null = fluxo normal pelo botao "Agendar horário")
  const [bookingServiceId, setBookingServiceId] = useState<string | null>(null);

  // servicos buscados pela MESMA rota que o BookingModal usa (fonte confiavel).
  // nao dependemos de est.services (que pode nao vir preenchido pelo getById).
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // container do carrossel (para as setas rolarem horizontalmente)
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    establishmentApi
      .getById(id)
      .then(setEst)
      .catch(() => setError("Não foi possível carregar o estabelecimento."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingServices(true);
    serviceApi
      .listByEstablishment(id)
      .then((list) => setServices(list))
      .catch(() => setServices([]))
      .finally(() => setLoadingServices(false));
  }, [id]);

  // abre o modal; se receber um serviceId, o modal ja entra naquele servico
  const openBooking = (serviceId?: string) => {
    setBookingServiceId(serviceId ?? null);
    setBookingOpen(true);
  };

  const closeBooking = () => {
    setBookingOpen(false);
    setBookingServiceId(null);
  };

  // rola o carrossel ~80% da largura visivel para os lados
  const scrollCarousel = (dir: -1 | 1) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.max(el.clientWidth * 0.8, 240),
      behavior: "smooth",
    });
  };

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

  // mostra as setas so quando ha mais de uma coluna (2 servicos por coluna)
  const showArrows = services.length > 2;

  // agrupa os servicos em colunas de 2 => 2 linhas no carrossel
  const serviceColumns: ServiceItem[][] = [];
  for (let i = 0; i < services.length; i += 2) {
    serviceColumns.push(services.slice(i, i + 2));
  }

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
          onClick={() => openBooking()}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-8 font-semibold text-white shadow-sm transition hover:bg-teal-600 sm:w-auto"
        >
          Agendar horário
        </button>
      </EstablishmentProfileHeader>

      {/* Serviços — carrossel de 2 linhas; clicar leva ao agendamento do serviço */}
      {loadingServices ? (
        <div className="mt-10 flex items-center gap-2 text-ink/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando serviços...
        </div>
      ) : services.length > 0 ? (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-ink">
              Serviços
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink/40">
                {services.length} disponíve
                {services.length !== 1 ? "is" : "l"}
              </span>
              {showArrows && (
                <div className="hidden gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => scrollCarousel(-1)}
                    aria-label="Serviços anteriores"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel(1)}
                    aria-label="Próximos serviços"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/*
            Carrossel: flex horizontal de COLUNAS; cada coluna empilha ate 2
            cards (as 2 linhas). Rola na horizontal e "espia" a proxima coluna
            no mobile. Abordagem em flex evita o colapso de altura do grid.
          */}
          <div
            ref={carouselRef}
            className="mt-4 flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin] snap-x snap-mandatory"
          >
            {serviceColumns.map((col, ci) => (
              <div
                key={ci}
                className="flex w-[82%] shrink-0 snap-start flex-col gap-3 sm:w-80"
              >
                {col.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => openBooking(s._id)}
                    className="group flex flex-1 items-start justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-5 text-left transition hover:border-teal-500/40 hover:shadow-sm"
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
            ))}
          </div>
        </div>
      ) : null}

      {/* Galeria antes/depois — some sozinha se não houver itens */}
      {id && <GallerySection establishmentId={id} />}

      {bookingOpen && (
        <BookingModal
          establishment={est}
          initialServiceId={bookingServiceId ?? undefined}
          onClose={closeBooking}
        />
      )}
    </PageContainer>
  );
}