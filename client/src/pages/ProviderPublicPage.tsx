import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../components/NavBar";
import { catalogApi, Service } from "../api/catalog";
import { establishmentApi, Establishment } from "../api/establishment";
import { ServiceCard } from "../components/ServiceCard";

// Página pública de um ESTABELECIMENTO (link /e/:establishmentId)
export function ProviderPublicPage() {
  const { establishmentId } = useParams<{ establishmentId: string }>();
  const [establishment, setEstablishment] = useState<Establishment | null>(
    null
  );
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!establishmentId) return;
    Promise.all([
      establishmentApi.getOne(establishmentId).catch(() => null),
      catalogApi.byEstablishment(establishmentId),
    ])
      .then(([est, svcs]) => {
        setEstablishment(est);
        setServices(svcs);
      })
      .finally(() => setLoading(false));
  }, [establishmentId]);

  return (
    <PageContainer>
      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : (
        <>
          <div className="rounded-2xl bg-teal-700 p-6 text-white">
            <p className="text-sm text-teal-100">Agende com</p>
            <h1 className="font-display text-3xl font-bold">
              {establishment?.name || "Estabelecimento"}
            </h1>
            {establishment?.city && (
              <p className="mt-1 text-teal-100">{establishment.city}</p>
            )}
          </div>

          {services.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-12 text-center text-ink/50">
              Este estabelecimento ainda não tem serviços disponíveis.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <ServiceCard key={s._id} service={s} />
              ))}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
