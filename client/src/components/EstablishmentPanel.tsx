import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AgendaTab } from "./AgendaTab";
import { ServiceManager } from "./ServiceManager";
import { BookingList } from "./BookingList";
import { ProfessionalManager } from "./ProfessionalManager";
import { CashRegister } from "./CashRegister";
import { ClientsManager } from "./ClientsManager";
import { Establishment } from "../api/establishment";
import { GalleryManager } from "./GalleryManager";
import { ProductManager } from "./ProductManager";
import { ReviewsManager } from "./ReviewsManager";
import { EstablishmentProfileHeader } from "./EstablishmentProfileHeader";
import { useEstablishments, PanelTab } from "../context/EstablishmentContext";
import { useNotifications } from "../context/NotificationContext";
import { useCoverageAlerts, useProsWithoutSchedule } from "../lib/coverage";

export function EstablishmentPanel({
  establishment,
  coverOverlay,
}: {
  establishment: Establishment;
  coverOverlay?: React.ReactNode;
}) {
  // papel do usuario neste estabelecimento (vem de /establishments/mine)
  const isEmployee = establishment.myRole === "professional";
  const myProfessionalId = establishment.myProfessionalId ?? null;

  // aba controlada pelo contexto: permite que a notificacao troque de aba
  const { tab, setTab } = useEstablishments();
  const navigate = useNavigate();

  // contador de agendamentos aguardando acao neste estabelecimento
  const { badges } = useNotifications();
  const pendingCount = badges.byEstablishment[establishment._id] || 0;

  // alertas de cobertura (profissional sem servico / servico sem profissional).
  // depende de `tab` para recarregar apos edicoes em outra aba.
  const { servicesWithoutPro, prosWithoutService } = useCoverageAlerts(
    establishment._id,
    tab
  );
  // profissionais sem expediente (aba Expediente)
  const { prosWithoutSchedule } = useProsWithoutSchedule(
    establishment._id,
    tab
  );

  const [copied, setCopied] = useState(false);

  // Rola a tela ate a FOTO DE PERFIL ficar ~20px abaixo da navbar. Ancorar na
  // foto (que existe desde o inicio) evita depender do carregamento do conteudo.
  // Reposiciona algumas vezes: enquanto a aba carrega e a pagina cresce, da
  // para descer mais — no maximo ate a foto encostar no alvo.
  useEffect(() => {
    const scrollToPhoto = () => {
      const avatar = document.getElementById("est-avatar");
      if (!avatar) return;
      const nav = document.querySelector("nav");
      const navH = nav ? Math.round(nav.getBoundingClientRect().height) : 64;
      // >>> AJUSTE AQUI <<< folga (px) entre a foto e a navbar
      const FOLGA = 130;
      const top =
        avatar.getBoundingClientRect().top + window.scrollY - navH - FOLGA;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };
    const timers = [0, 250, 600, 1000].map((t) =>
      window.setTimeout(scrollToPhoto, t)
    );
    return () => timers.forEach((id) => clearTimeout(id));
  }, [tab, establishment._id]);

  const link = `${window.location.origin}/estabelecimento/${establishment._id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // abas visiveis conforme o papel. funcionario nao ve "equipe".
  const allTabs: [PanelTab, string][] = [
    ["servicos", "Serviços"],
    ["equipe", "Equipe"],
    ["agenda", "Expediente"],
    ["recebidos", "Agendamentos recebidos"],
    ["clientes", "Clientes"],
    ["avaliacoes", "Avaliações"],
    ["galeria", "Galeria"],
    ["produtos", "Produtos"],
    ["caixa", "Caixa"],
  ];

  const tabs = isEmployee
    ? allTabs.filter(([key]) => key !== "equipe")
    : allTabs;

  return (
    <div>
      <EstablishmentProfileHeader
        key={establishment._id}
        establishmentId={establishment._id}
        name={establishment.name}
        categoryIcon={establishment.category?.icon}
        categoryName={establishment.category?.name}
        city={establishment.address?.city}
        state={establishment.address?.state}
        description={establishment.description}
        initialPhoto={establishment.photo}
        initialCovers={establishment.coverPhotos}
        ratingAvg={establishment.ratingAvg}
        ratingCount={establishment.ratingCount}
        onEdit={
          !isEmployee
            ? () => navigate(`/estabelecimento/${establishment._id}/editar`)
            : undefined
        }
        editable={!isEmployee}
        coverOverlay={coverOverlay}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-teal-700 p-4 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-teal-100">
            Link de agendamento deste estabelecimento
          </p>
          <p className="truncate font-mono text-sm">{link}</p>
        </div>
        {!isEmployee && (
          <button
            onClick={() => navigate(`/estabelecimento/${establishment._id}/editar`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
            title="Editar estabelecimento"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.37-.84-2.95.74-2.11 2.11.6.98.02 2.25-1.1 2.4-1.6.2-1.6 2.6 0 2.98a1.53 1.53 0 01.95 2.29c-.84 1.37.74 2.95 2.11 2.11a1.53 1.53 0 012.29.95c.38 1.56 2.6 1.56 2.98 0a1.53 1.53 0 012.29-.95c1.37.84 2.95-.74 2.11-2.11a1.53 1.53 0 01.95-2.29c1.56-.38 1.56-2.6 0-2.98a1.53 1.53 0 01-.95-2.29c.84-1.37-.74-2.95-2.11-2.11a1.53 1.53 0 01-2.29-.95zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
            Editar
          </button>
        )}
        <button
          onClick={copyLink}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-amber-500"
        >
          {copied ? "Copiado!" : "Copiar link"}
        </button>
      </div>

      <div className="mt-8 flex gap-1 border-b border-ink/10 overflow-x-auto">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative -mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === key
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-ink/50 hover:text-ink/80"
            }`}
          >
            {label}
            {key === "recebidos" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
            {/* alerta: profissionais sem servico (so o dono age nisso) */}
            {!isEmployee &&
              key === "equipe" &&
              prosWithoutService.size > 0 && (
                <span
                  title="Há profissional sem serviço"
                  className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[12px] font-bold text-ink"
                >
                  !
                </span>
              )}
            {/* alerta: servicos sem profissional */}
            {!isEmployee &&
              key === "servicos" &&
              servicesWithoutPro.size > 0 && (
                <span
                  title="Há serviço sem profissional"
                  className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[12px] font-bold text-ink"
                >
                  !
                </span>
              )}
            {/* alerta: profissionais sem expediente */}
            {!isEmployee &&
              key === "agenda" &&
              prosWithoutSchedule.size > 0 && (
                <span
                  title="Há profissional sem expediente"
                  className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[12px] font-bold text-ink"
                >
                  !
                </span>
              )}
          </button>
        ))}
      </div>

      {/* min-h-screen garante altura suficiente para a rolagem alcancar a foto
          mesmo quando a aba esta vazia (sem dados, o conteudo seria curto).
          >>> AJUSTE AQUI <<< pode trocar por min-h-[70vh] se preferir menos
          espaco em branco nas abas vazias. */}
      <div className="mt-6 min-h-screen">
        {tab === "servicos" && (
          <ServiceManager
            establishmentId={establishment._id}
            myProfessionalId={isEmployee ? myProfessionalId : null}
          />
        )}
        {tab === "equipe" && !isEmployee && (
          <ProfessionalManager establishmentId={establishment._id} />
        )}
        {tab === "agenda" && (
          <AgendaTab
            establishmentId={establishment._id}
            myProfessionalId={isEmployee ? myProfessionalId : null}
          />
        )}
        {tab === "recebidos" && (
          <div id="painel-recebidos" className="scroll-mt-24">
            <BookingList role="provider" establishmentId={establishment._id} />
          </div>
        )}
        {tab === "clientes" && (
          <ClientsManager establishmentId={establishment._id} />
        )}
        {tab === "avaliacoes" && (
          <ReviewsManager establishmentId={establishment._id} />
        )}
        {tab === "galeria" && (
          <GalleryManager establishmentId={establishment._id} />
        )}
        {tab === "produtos" && (
          <ProductManager establishmentId={establishment._id} />
        )}
        {tab === "caixa" && (
          <CashRegister establishmentId={establishment._id} />
        )}
      </div>
    </div>
  );
}