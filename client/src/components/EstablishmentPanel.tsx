import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AgendaTab } from "./AgendaTab";
import { ServiceManager } from "./ServiceManager";
import { BookingList } from "./BookingList";
import { ProfessionalManager } from "./ProfessionalManager";
import { professionalApi } from "../api/professional";
import { CashRegister } from "./CashRegister";
import { ClientsManager } from "./ClientsManager";
import { Establishment } from "../api/establishment";
import { GalleryManager } from "./GalleryManager";
import { ProductManager } from "./ProductManager";
import { ReviewsManager } from "./ReviewsManager";
import { ProntuarioManager } from "./ProntuarioManager";
import { FichaBelezaManager } from "./FichaBelezaManager";
import { SterilizationManager } from "./SterilizationManager";
import { OrdemServicoManager } from "./OrdemServicoManager";
import { PersonalManager } from "./PersonalManager";
import { NutricaoManager } from "./NutricaoManager";
import { PodologiaManager } from "./PodologiaManager";
import { EnfermagemManager } from "./EnfermagemManager";
import { DermatologiaManager } from "./DermatologiaManager";
import { QuiropraxiaManager } from "./QuiropraxiaManager";
import { AcupunturaManager } from "./AcupunturaManager";
import { FidelidadeManager } from "./FidelidadeManager";
import { QrShareModal } from "./QrShareModal";
import { AgendaShareModal } from "./AgendaShareModal";
import { AulasManager } from "./AulasManager";
import { MaintenanceManager } from "./MaintenanceManager";
import { FotografiaManager } from "./FotografiaManager";
import { ObrasManager } from "./ObrasManager";
import { AnamneseManager } from "./AnamneseManager";
import { EnrollmentManager } from "./EnrollmentManager";
import { CommissionsManager } from "./CommissionsManager";
import { ConvenioManager } from "./ConvenioManager";
import { AuditManager } from "./AuditManager";
import { EstablishmentProfileHeader } from "./EstablishmentProfileHeader";
import { useEstablishments, PanelTab } from "../context/EstablishmentContext";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { useCoverageAlerts, useProsWithoutSchedule } from "../lib/coverage";
import { hasModule } from "../lib/segments";
import { scheduleApi } from "../api/schedule";
import { catalogApi } from "../api/catalog";

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
  const { servicesWithoutPro, prosWithoutService, noServices } =
    useCoverageAlerts(establishment._id, tab);
  // profissionais sem expediente (aba Expediente)
  const { prosWithoutSchedule } = useProsWithoutSchedule(
    establishment._id,
    tab
  );

  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedPersonal, setCopiedPersonal] = useState(false);
  const [qrOpen, setQrOpen] = useState(false); // QR do estabelecimento
  const [qrProOpen, setQrProOpen] = useState(false); // QR pessoal (link ?prof=)
  const [agendaOpen, setAgendaOpen] = useState(false); // banner da agenda (estab.)
  const [agendaProOpen, setAgendaProOpen] = useState(false); // banner da agenda (pessoal)
  // quantidade de profissionais agendaveis (define se o link pessoal aparece)
  const [proCount, setProCount] = useState(0);
  useEffect(() => {
    professionalApi
      .list(establishment._id)
      .then((l) => setProCount(l.length))
      .catch(() => setProCount(0));
  }, [establishment._id]);

  // A aba Matriculas so faz sentido quando o estabelecimento tem servico do
  // tipo "aula" (matricula gera aulas recorrentes na agenda). hasAula controla
  // a exibicao da aba; semMatricula e o alerta de aluno com aula avulsa sem
  // matricula (so para o dono).
  const [hasAula, setHasAula] = useState(false);
  const [semMatricula, setSemMatricula] = useState(0);
  useEffect(() => {
    if (establishment.segment !== "geral") {
      setHasAula(false);
      setSemMatricula(0);
      return;
    }
    let alive = true;
    const compute = () => {
      catalogApi
        .byEstablishment(establishment._id)
        .catch(() => [])
        .then((svcs) => {
          if (!alive) return;
          const aulaIds = svcs
            .filter((s) => s.kind === "aula")
            .map((s) => s._id);
          setHasAula(aulaIds.length > 0);
          // alerta de aula avulsa sem matricula: so o dono age nisso
          if (isEmployee || aulaIds.length === 0) {
            setSemMatricula(0);
            return;
          }
          const aula = new Set(aulaIds);
          scheduleApi
            .listBookings("provider", establishment._id)
            .catch(() => [])
            .then((bookings) => {
              if (!alive) return;
              const enrolled = new Set(
                bookings
                  .filter(
                    (b) =>
                      b.seriesId && b.status !== "cancelado" && b.client?._id
                  )
                  .map((b) => b.client._id)
              );
              const has = bookings.some(
                (b) =>
                  !b.seriesId &&
                  b.status !== "cancelado" &&
                  b.service?._id &&
                  aula.has(b.service._id) &&
                  b.client?._id &&
                  !enrolled.has(b.client._id)
              );
              setSemMatricula(has ? 1 : 0);
            });
        });
    };
    compute();
    // recalcula ao voltar o foco (ex.: apos um cliente agendar em outra aba)
    window.addEventListener("focus", compute);
    return () => {
      alive = false;
      window.removeEventListener("focus", compute);
    };
  }, [establishment._id, establishment.segment, isEmployee, tab]);

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
  // link pessoal do profissional logado (funcionario ou dono-profissional):
  // abre o perfil do estabelecimento com ele ja pre-selecionado no agendamento.
  // So faz sentido com equipe (mais de um profissional); com um unico
  // profissional, o link pessoal e igual ao do estabelecimento -> escondido.
  const myLink =
    myProfessionalId && proCount > 1 ? `${link}?prof=${myProfessionalId}` : null;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPersonal = async () => {
    if (!myLink) return;
    await navigator.clipboard.writeText(myLink);
    setCopiedPersonal(true);
    setTimeout(() => setCopiedPersonal(false), 2000);
  };

  // abas visiveis conforme o papel. funcionario nao ve "equipe".
  const allTabs: [PanelTab, string][] = [
    ["servicos", "Serviços"],
    ["equipe", "Equipe"],
    ["agenda", "Expediente"],
    ["recebidos", "Agendamentos"],
    ["ordem_servico", "Ordens de serviço"],
    ["personal", "Alunos"],
    ["nutricao", "Nutrição"],
    ["podologia", "Podologia"],
    ["enfermagem", "Enfermagem"],
    ["dermatologia", "Dermatologia"],
    ["quiropraxia", "Quiropraxia"],
    ["acupuntura", "Acupuntura"],
    ["aulas", "Aulas"],
    ["manutencao", "Manutenção"],
    ["foto", "Ensaios"],
    ["obra", "Obras"],
    ["matriculas", "Matrículas"],
    ["clientes", "Clientes"],
    ["prontuario", "Prontuário"],
    ["anamnese_link", "Anamnese online"],
    ["ficha", "Ficha do cliente"],
    ["avaliacoes", "Avaliações"],
    ["fidelidade", "Fidelidade"],
    ["galeria", "Galeria"],
    ["produtos", "Produtos"],
    ["caixa", "Caixa"],
    ["comissoes", "Comissões"],
    ["convenio", "Convênios"],
    ["esterilizacao", "Esterilização"],
    ["auditoria", "Auditoria"],
  ];

  // mostra apenas as abas cujo modulo pertence a AREA do estabelecimento
  // (estabelecimentos antigos sem segment caem no padrao = beleza).
  const tabs = allTabs
    .filter(([key]) =>
      key === "matriculas"
        ? establishment.segment === "geral" && hasAula // so com servico "aula"
        : hasModule(establishment.segment, key, establishment.category?.slug)
    )
    // funcionario nao ve "equipe" nem "auditoria" (dados do dono/controlador).
    // "comissoes" ele ve, mas so a propria (limitado no componente).
    .filter(
      ([key]) => !(isEmployee && (key === "equipe" || key === "auditoria"))
    );

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

      {/* Bloco compacto de links — 1 linha por link (rótulo + ações em ícone),
          para não roubar espaço vertical e não quebrar no mobile. As URLs
          longas saíram (já vêm no Copiar/QR). */}
      <div className="mt-3 rounded-xl bg-teal-700 px-3 py-2 text-white">
        {/* Link do estabelecimento */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <svg
              className="h-4 w-4 shrink-0 text-teal-200"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8.5 5.5a3.5 3.5 0 000 5h1.5a1 1 0 100-2H8.5a1.5 1.5 0 010-3H10a1 1 0 100-2H8.5zm3 0a1 1 0 100 2H13a1.5 1.5 0 010 3h-1.5a1 1 0 100 2H13a3.5 3.5 0 000-7h-1.5z" />
            </svg>
            <p className="truncate text-sm font-medium text-teal-50">
              Link do estabelecimento
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={copyLink}
              className="inline-flex h-8 items-center rounded-lg bg-amber-400 px-3 text-sm font-semibold text-ink transition hover:bg-amber-500"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
            <button
              onClick={() => setQrOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
              title="QR Code do estabelecimento (divulgar, imprimir, compartilhar)"
              aria-label="QR Code do estabelecimento"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 3h5v5H3V3zm2 2v1h1V5H5zM3 12h5v5H3v-5zm2 2v1h1v-1H5zM12 3h5v5h-5V3zm2 2v1h1V5h-1zM12 12h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setAgendaOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
              title="Divulgar agenda do estabelecimento (banner p/ redes sociais)"
              aria-label="Divulgar agenda do estabelecimento"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v7H4V8z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Meu link pessoal (profissional logado) */}
        {myLink && (
          <div className="mt-0.0 flex items-center gap-2 border-t border-white/15 pt-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <svg
                className="h-4 w-4 shrink-0 text-teal-200"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10 8a3 3 0 100-6 3 3 0 000 6zm-6 9a6 6 0 1112 0H4z" />
              </svg>
              <p className="truncate text-sm font-medium text-teal-50">
                Meu link pessoal
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={copyPersonal}
                className="inline-flex h-8 items-center rounded-lg bg-amber-400 px-3 text-sm font-semibold text-ink transition hover:bg-amber-500"
              >
                {copiedPersonal ? "Copiado!" : "Copiar"}
              </button>
              <button
                onClick={() => setQrProOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
                title="Seu QR pessoal (o cliente agenda já com você selecionado)"
                aria-label="Seu QR pessoal"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 3h5v5H3V3zm2 2v1h1V5H5zM3 12h5v5H3v-5zm2 2v1h1v-1H5zM12 3h5v5h-5V3zm2 2v1h1V5h-1zM12 12h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setAgendaProOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
                title="Divulgar sua agenda (banner p/ redes sociais)"
                aria-label="Divulgar sua agenda"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v7H4V8z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-ink/10 pb-4">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? "bg-teal-500 text-white shadow-sm"
                : "bg-ink/5 text-ink/60 hover:bg-ink/10 hover:text-ink/80"
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
            {/* alerta: nenhum servico cadastrado ainda (estabelecimento novo) */}
            {!isEmployee && key === "servicos" && noServices && (
              <span
                title="Cadastre um serviço para começar a receber agendamentos"
                className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[12px] font-bold text-ink"
              >
                !
              </span>
            )}
            {/* alerta: servicos sem profissional */}
            {!isEmployee &&
              key === "servicos" &&
              !noServices &&
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
            {/* alerta: aluno agendou aula avulsa sem matricula */}
            {!isEmployee && key === "matriculas" && semMatricula > 0 && (
              <span
                title="Há aluno sem matrícula"
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
        {tab === "prontuario" && (
          <ProntuarioManager establishment={establishment} />
        )}
        {tab === "anamnese_link" && (
          <AnamneseManager establishmentId={establishment._id} />
        )}
        {tab === "ficha" && (
          <FichaBelezaManager establishment={establishment} />
        )}
        {tab === "galeria" && (
          <GalleryManager establishmentId={establishment._id} />
        )}
        {tab === "produtos" && (
          <ProductManager establishmentId={establishment._id} />
        )}
        {tab === "caixa" && (
          <CashRegister
            establishmentId={establishment._id}
            isOwner={!isEmployee}
          />
        )}
        {tab === "comissoes" && (
          <CommissionsManager
            establishmentId={establishment._id}
            isOwner={!isEmployee}
          />
        )}
        {tab === "convenio" && (
          <ConvenioManager
            establishmentId={establishment._id}
            isOwner={!isEmployee}
          />
        )}
        {tab === "esterilizacao" && (
          <SterilizationManager establishmentId={establishment._id} />
        )}
        {tab === "ordem_servico" && (
          <OrdemServicoManager
            establishmentId={establishment._id}
            showVehicle={hasModule(
              establishment.segment,
              "veiculo",
              establishment.category?.slug
            )}
            showEquipment={hasModule(
              establishment.segment,
              "equipamento",
              establishment.category?.slug
            )}
            showPest={hasModule(
              establishment.segment,
              "dedetizacao",
              establishment.category?.slug
            )}
            showWarranty={hasModule(
              establishment.segment,
              "garantia",
              establishment.category?.slug
            )}
            showMeasurements={hasModule(
              establishment.segment,
              "medidas",
              establishment.category?.slug
            )}
          />
        )}
        {tab === "personal" && (
          <PersonalManager establishment={establishment} />
        )}
        {tab === "nutricao" && (
          <NutricaoManager establishment={establishment} />
        )}
        {tab === "podologia" && (
          <PodologiaManager establishment={establishment} />
        )}
        {tab === "enfermagem" && (
          <EnfermagemManager establishment={establishment} />
        )}
        {tab === "dermatologia" && (
          <DermatologiaManager establishment={establishment} />
        )}
        {tab === "quiropraxia" && (
          <QuiropraxiaManager establishment={establishment} />
        )}
        {tab === "acupuntura" && (
          <AcupunturaManager establishment={establishment} />
        )}
        {tab === "fidelidade" && (
          <FidelidadeManager establishment={establishment} />
        )}
        {tab === "aulas" && (
          <AulasManager establishmentId={establishment._id} />
        )}
        {tab === "manutencao" && (
          <MaintenanceManager establishmentId={establishment._id} />
        )}
        {tab === "foto" && (
          <FotografiaManager establishmentId={establishment._id} />
        )}
        {tab === "obra" && (
          <ObrasManager establishmentId={establishment._id} />
        )}
        {tab === "matriculas" && (
          <EnrollmentManager establishment={establishment} />
        )}
        {tab === "auditoria" && !isEmployee && (
          <AuditManager establishmentId={establishment._id} />
        )}
      </div>

      {qrOpen && (
        <QrShareModal
          title={establishment.name}
          subtitle="Aponte a câmera para agendar"
          url={link}
          onClose={() => setQrOpen(false)}
        />
      )}

      {qrProOpen && myLink && (
        <QrShareModal
          title={user?.name || establishment.name}
          subtitle={`Agende comigo em ${establishment.name}`}
          url={myLink}
          onClose={() => setQrProOpen(false)}
        />
      )}

      {agendaOpen && (
        <AgendaShareModal
          establishmentId={establishment._id}
          establishmentName={establishment.name}
          onClose={() => setAgendaOpen(false)}
        />
      )}

      {agendaProOpen && myLink && myProfessionalId && (
        <AgendaShareModal
          establishmentId={establishment._id}
          establishmentName={establishment.name}
          professionalName={user?.name || null}
          professionalId={myProfessionalId}
          onClose={() => setAgendaProOpen(false)}
        />
      )}
    </div>
  );
}