import { useEffect, useMemo, useState } from "react";
import { scheduleApi } from "../api/schedule";
import { serviceApi, ServiceItem } from "../api/service";
import { professionalApi, Professional } from "../api/professional";
import { Establishment } from "../api/establishment";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "./AuthModal";
import { ReminderModal } from "./ReminderModal";
import {
  AddressAutocomplete,
  ResolvedAddress,
} from "./AddressAutocomplete";

// monta "YYYY-MM-DD" a partir da data LOCAL (sem converter para UTC)
function toLocalYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// gera os próximos N dias como opções de data
function nextDays(count: number) {
  const out: { value: string; weekday: string; day: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = toLocalYMD(d);
    out.push({
      value,
      weekday: d.toLocaleDateString("pt-BR", { weekday: "short" }),
      day: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    });
  }
  return out;
}

// formata um ISO para HH:mm local
function slotLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// formata um ISO para "dd/mm às HH:mm"
function fullLabel(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  })} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

type Step = "professional" | "service" | "slot";
type Frequency = "semanal" | "quinzenal";

interface RecurringResult {
  createdCount: number;
  skippedCount: number;
  skipped: { date: string; reason: string }[];
}

export function BookingModal({
  establishment,
  onClose,
  initialServiceId,
  initialProfessionalId,
}: {
  establishment: Establishment;
  onClose: () => void;
  // servico pre-selecionado (ex.: clique no card do carrossel).
  // quando presente, o modal pula a etapa de servico e vai direto
  // para profissional -> horario daquele servico.
  initialServiceId?: string;
  // profissional pre-selecionado (ex.: link/QR proprio do funcionario).
  // quando presente e valido, o modal ja entra com ele escolhido e pula a
  // etapa de escolha de profissional.
  initialProfessionalId?: string;
}) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loadingPros, setLoadingPros] = useState(true);
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  const [maxFutureDays, setMaxFutureDays] = useState(30);

  const [step, setStep] = useState<Step>("service");
  // combo: varios servicos selecionados. serviceId (primeiro) fica derivado
  // para compatibilidade com o resto do fluxo (recorrencia, lista de espera).
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialServiceId ? [initialServiceId] : []
  );
  const serviceId = selectedIds[0] ?? "";

  // servico veio travado pelo card: nao existe etapa de escolha de servico
  const serviceLocked = Boolean(initialServiceId);

  const [date, setDate] = useState<string>(toLocalYMD(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  // antecedencia do lembrete escolhida pelo cliente (min); todo agendamento tem
  const [reminderMinutes, setReminderMinutes] = useState<number>(60);
  // controla o modal de lembrete (abre ao confirmar, antes de criar)
  const [showReminder, setShowReminder] = useState(false);

  const { user } = useAuth();
  // acao que o visitante tentou fazer antes de logar
  const [authFor, setAuthFor] = useState<null | "confirm" | "waitlist">(null);
  // acao a executar assim que o login completar
  const [pendingAction, setPendingAction] = useState<null | "confirm" | "waitlist">(null);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);

  // recorrência
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("semanal");
  const [repetitions, setRepetitions] = useState(4);
  const [recurringResult, setRecurringResult] =
    useState<RecurringResult | null>(null);

  // atendimento a domicilio: modalidade + endereco/coordenadas do cliente
  const [atHome, setAtHome] = useState(false);
  const [homeCoords, setHomeCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [homeAddr, setHomeAddr] = useState<{
    country: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    number: string;
  } | null>(null);

  const days = useMemo(() => nextDays(maxFutureDays + 1), [maxFutureDays]);

  const selectedService = services.find((s) => s._id === serviceId);
  const hasTeam = professionals.length > 0;
  const selectedPro = professionals.find((p) => p._id === professionalId);

  // servicos selecionados (combo), na ordem escolhida, e os totais
  const selectedServices = useMemo(
    () =>
      selectedIds
        .map((id) => services.find((s) => s._id === id))
        .filter((s): s is ServiceItem => Boolean(s)),
    [selectedIds, services]
  );
  const isCombo = selectedServices.length > 1;
  const totalDuration = selectedServices.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  const totalPrice = selectedServices.reduce(
    (sum, s) =>
      sum + (s.billing === "mensal" ? s.monthlyPrice ?? 0 : s.price),
    0
  );
  // sinal exigido (soma por servico); 0 = nenhum servico pede sinal
  const depositForItem = (s: ServiceItem): number => {
    const type = s.depositType || "none";
    const val = s.depositValue || 0;
    if (type === "none" || val <= 0) return 0;
    const raw = type === "percent" ? (s.price * val) / 100 : val;
    return Math.round(Math.min(raw, s.price) * 100) / 100;
  };
  const totalDeposit =
    Math.round(
      selectedServices.reduce((sum, s) => sum + depositForItem(s), 0) * 100
    ) / 100;

  // ---- atendimento a domicilio ----
  const homeCfg = establishment.homeService;
  // oferece quando TODOS os servicos escolhidos podem ser a domicilio
  // (modo != "local"). Forcado quando algum servico e so domicilio.
  const homeAvailable =
    selectedServices.length > 0 &&
    selectedServices.every((s) => (s.serviceMode || "local") !== "local");
  const homeForced =
    homeAvailable &&
    selectedServices.some((s) => s.serviceMode === "domicilio");

  // estimativa de deslocamento (linha reta x velocidade media), so p/ exibir.
  // O valor definitivo e calculado no servidor ao agendar.
  const travelEstimate = useMemo(() => {
    if (!atHome || !homeCoords) return null;
    const est = establishment.location?.coordinates;
    if (!est || (est[0] === 0 && est[1] === 0)) return null;
    const speed = homeCfg?.avgSpeedKmh || 25;
    const baseFee = homeCfg?.baseFee || 0;
    const feePerKm = homeCfg?.feePerKm || 0;
    const maxRadiusKm = homeCfg?.maxRadiusKm || 0;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(homeCoords.lat - est[1]);
    const dLon = toRad(homeCoords.lon - est[0]);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 *
        Math.cos(toRad(est[1])) *
        Math.cos(toRad(homeCoords.lat));
    const straight = 2 * R * Math.asin(Math.sqrt(a));
    const km = Math.round(straight * 1.3 * 100) / 100;
    const oneWay = Math.ceil((km / speed) * 60);
    const fee = Math.round((baseFee + feePerKm * km * 2) * 100) / 100;
    const overRadius = maxRadiusKm > 0 && km > maxRadiusKm;
    return { km, oneWay, fee, overRadius };
  }, [atHome, homeCoords, homeCfg, establishment.location]);

  // força/limpa a modalidade conforme a disponibilidade
  useEffect(() => {
    if (homeForced) setAtHome(true);
    else if (!homeAvailable) setAtHome(false);
  }, [homeForced, homeAvailable]);

  const applyHomeAddress = (addr: ResolvedAddress) => {
    setHomeAddr({
      country: addr.country || "Brasil",
      state: addr.state,
      city: addr.city,
      neighborhood: addr.neighborhood,
      street: addr.street,
      number: addr.number || "",
    });
    setHomeCoords({ lat: addr.lat, lon: addr.lon });
  };
  // a domicilio: precisa do NUMERO do endereco (local exato do atendimento)
  const homeNumberOk = atHome
    ? !!homeAddr && homeAddr.number.trim() !== ""
    : true;
  // a domicilio fora do raio: bloqueia a confirmacao
  const homeBlocked = atHome && travelEstimate?.overRadius === true;

  // serviços visíveis: filtrados pelo profissional escolhido
  const visibleServices = useMemo(() => {
    if (!professionalId) return services;
    return services.filter((s) => {
      const pros = s.professionals ?? [];
      return pros.length === 0 || pros.includes(professionalId);
    });
  }, [services, professionalId]);

  // profissionais visíveis: quando o servico ja veio travado (clique no card),
  // mostra so quem presta aquele servico. Mesma convencao dos servicos:
  // servico sem lista de profissionais = feito por todos.
  const visibleProfessionals = useMemo(() => {
    if (!serviceLocked || !selectedService) return professionals;
    const allowed = selectedService.professionals ?? [];
    if (allowed.length === 0) return professionals;
    return professionals.filter((p) => allowed.includes(p._id));
  }, [professionals, serviceLocked, selectedService]);

  useEffect(() => {
    setLoadingPros(true);
    professionalApi
      .list(establishment._id)
      .then((list) => {
        setProfessionals(list);
        // link/QR de um profissional: ja entra com ele escolhido e pula a
        // etapa de profissional (mantendo servico -> horario).
        const pre =
          initialProfessionalId &&
          list.find((p) => p._id === initialProfessionalId && p.active);
        if (pre) {
          setProfessionalId(pre._id);
          setStep(serviceLocked ? "slot" : "service");
          return;
        }
        // com equipe: comeca escolhendo o profissional.
        // sem equipe: se o servico ja veio travado, vai direto ao horario;
        // senao, escolhe o servico.
        setStep(
          list.length > 0
            ? "professional"
            : serviceLocked
              ? "slot"
              : "service"
        );
      })
      .catch(() => {
        setProfessionals([]);
        setStep(serviceLocked ? "slot" : "service");
      })
      .finally(() => setLoadingPros(false));

    setLoadingServices(true);
    serviceApi
      .listByEstablishment(establishment._id)
      .then((list) => setServices(list))
      .catch(() => setError("Não foi possível carregar os serviços."))
      .finally(() => setLoadingServices(false));

    scheduleApi
      .getAvailability(establishment._id)
      .then((a) => {
        if (a?.maxFutureDays) setMaxFutureDays(a.maxFutureDays);
      })
      .catch(() => {
        /* mantém 30 */
      });
  }, [establishment._id, serviceLocked, initialProfessionalId]);

  useEffect(() => {
    if (step !== "slot" || selectedIds.length === 0 || !date) return;
    // a domicilio: sem endereco/coordenadas/numero ainda, nao busca horarios
    if (atHome && (!homeCoords || !homeNumberOk)) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    setWaitlistJoined(false);
    setError(null);
    // deslocamento (a domicilio) reserva a agenda ao redor do horario
    const home =
      atHome && homeCoords
        ? { lat: homeCoords.lat, lng: homeCoords.lon }
        : null;
    // combo (>1 servico): usa combo-slots (soma das duracoes); senao, freeSlots
    const req = isCombo
      ? scheduleApi.comboSlots(
          establishment._id,
          selectedIds,
          date,
          professionalId,
          home
        )
      : scheduleApi.freeSlots(serviceId, date, professionalId, home);
    req
      .then((res) => setSlots(res.slots))
      .catch(() => setError("Não foi possível carregar os horários."))
      .finally(() => setLoadingSlots(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedIds, date, professionalId, atHome, homeCoords, homeNumberOk]);

  // executa a acao pendente assim que o usuario estiver autenticado
  useEffect(() => {
    if (!user || !pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    // "confirm" apos login: abre o modal de lembrete (a criacao acontece la)
    if (action === "confirm") setShowReminder(true);
    else if (action === "waitlist") void joinWaitlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingAction]);

  const pickProfessional = (id: string) => {
    setProfessionalId(id);
    // servico travado: nao ha etapa de servico, vai direto ao horario
    setStep(serviceLocked ? "slot" : "service");
  };

  // combo: alterna um servico na selecao (marca/desmarca)
  const toggleService = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const goBack = () => {
    if (step === "slot") {
      setSelectedSlot(null);
      setSlots([]);
      setWaitlistJoined(false);
      setRecurring(false);
      // servico travado pelo card: nao existe etapa de servico.
      // volta ao profissional (quando ha equipe); senao nao ha para onde voltar.
      if (serviceLocked) {
        if (hasTeam) setStep("professional");
      } else {
        setStep("service");
      }
    } else if (step === "service" && hasTeam) {
      setStep("professional");
    }
  };

  const canGoBack =
    (step === "slot" && (!serviceLocked || hasTeam)) ||
    (step === "service" && hasTeam);

  // clique no botao do rodape: valida login e abre o modal de lembrete.
  // A criacao do agendamento acontece em confirm(), disparado pelo modal.
  const openReminder = () => {
    if (!selectedSlot) return;
    // visitante deslogado: pede login/cadastro e retoma depois (reabre o modal)
    if (!user) {
      setAuthFor("confirm");
      return;
    }
    setShowReminder(true);
  };

  const confirm = async () => {
    if (!selectedSlot) return;

    // trava de seguranca: nao cria sem estar logado
    if (!user) {
      setShowReminder(false);
      setAuthFor("confirm");
      return;
    }

    setBooking(true);
    setError(null);
    try {
      if (recurring && !isCombo && !atHome) {
        const res = await scheduleApi.createRecurring({
          serviceId,
          scheduledAt: selectedSlot,
          professionalId: professionalId || undefined,
          notes: notes.trim() || undefined,
          frequency,
          repetitions,
          clientReminderMinutes: reminderMinutes,
        });
        setRecurringResult({
          createdCount: res.createdCount,
          skippedCount: res.skippedCount,
          skipped: res.skipped,
        });
      } else {
        await scheduleApi.createBooking({
          serviceIds: selectedIds,
          scheduledAt: selectedSlot,
          notes: notes.trim() || undefined,
          professionalId: professionalId || undefined,
          clientReminderMinutes: reminderMinutes,
          atHome,
          homeAddress: atHome && homeAddr ? homeAddr : undefined,
          homeCoords:
            atHome && homeCoords
              ? { lat: homeCoords.lat, lng: homeCoords.lon }
              : undefined,
        });
      }
      setShowReminder(false);
      setDone(true);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 409
          ? "Nenhum horário da série está disponível. Tente outro horário."
          : "Não foi possível concluir o agendamento. Tente outro horário."
      );
    } finally {
      setBooking(false);
    }
  };

  const joinWaitlist = async () => {
    if (!user) {
      setAuthFor("waitlist");
      return;
    }
    setJoiningWaitlist(true);
    // ... resto igual
    setError(null);
    try {
      await scheduleApi.joinWaitlist({
        serviceId,
        targetDate: date,
        professionalId: professionalId || undefined,
      });
      setWaitlistJoined(true);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) setWaitlistJoined(true);
      else setError("Não foi possível entrar na lista de espera.");
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const headerTitle =
    step === "professional"
      ? "Escolha o profissional"
      : step === "service"
        ? "Escolha o serviço"
        : "Escolha o horário";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-ink/10 p-5">
          <div className="flex items-center gap-3">
            {canGoBack && !done && (
              <button
                onClick={goBack}
                className="rounded-lg p-1.5 text-ink/50 transition hover:bg-sand"
                aria-label="Voltar"
              >
                ←
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-ink">{headerTitle}</h2>
              <p className="text-sm text-ink/50">
                {establishment.name}
                {selectedPro && step !== "professional" && (
                  <> · com {selectedPro.name}</>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/10 text-2xl">
              ✓
            </div>
            <h3 className="text-lg font-semibold text-ink">
              {recurringResult
                ? `${recurringResult.createdCount} agendamento${recurringResult.createdCount !== 1 ? "s" : ""
                } solicitado${recurringResult.createdCount !== 1 ? "s" : ""}!`
                : "Agendamento solicitado!"}
            </h3>
            <p className="mt-1 text-sm text-ink/60">
              Você receberá a confirmação do estabelecimento em breve.
            </p>

            {/* datas que não puderam ser criadas */}
            {recurringResult && recurringResult.skippedCount > 0 && (
              <div className="mt-5 rounded-xl bg-amber-400/10 p-4 text-left">
                <p className="text-sm font-medium text-amber-800">
                  {recurringResult.skippedCount} data
                  {recurringResult.skippedCount !== 1 ? "s" : ""} não pôde ser
                  agendada:
                </p>
                <ul className="mt-2 space-y-1">
                  {recurringResult.skipped.map((s, i) => (
                    <li key={i} className="text-xs text-amber-800/80">
                      {fullLabel(s.date)} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            {/* ETAPA 0 — profissionais */}
            {step === "professional" && (
              <>
                {loadingPros || (serviceLocked && loadingServices) ? (
                  <div className="flex items-center gap-2 py-6 text-ink/50">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
                    Carregando profissionais...
                  </div>
                ) : visibleProfessionals.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/50">
                    Nenhum profissional disponível para este serviço no momento.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {visibleProfessionals.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => pickProfessional(p._id)}
                        className="group flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500 hover:shadow-sm"
                      >
                        {p.photo ? (
                          <img
                            src={p.photo}
                            alt={p.name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 text-lg font-bold text-teal-600">
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <h3 className="font-medium text-ink group-hover:text-teal-600">
                            {p.name}
                          </h3>
                          {p.specialties.length > 0 && (
                            <p className="mt-0.5 text-xs text-ink/50">
                              {p.specialties.join(" · ")}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ETAPA 1 — serviços */}
            {step === "service" && (
              <>
                {loadingServices ? (
                  <div className="flex items-center gap-2 py-6 text-ink/50">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
                    Carregando serviços...
                  </div>
                ) : visibleServices.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/50">
                    {professionalId
                      ? "Este profissional não realiza nenhum serviço no momento."
                      : "Este estabelecimento ainda não cadastrou serviços."}
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-ink/50">
                      Selecione um ou mais serviços.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {visibleServices.map((s) => {
                        const on = selectedIds.includes(s._id);
                        return (
                          <button
                            key={s._id}
                            onClick={() => toggleService(s._id)}
                            className={`group flex flex-col rounded-xl border p-4 text-left transition hover:shadow-sm ${
                              on
                                ? "border-teal-500 bg-teal-500/5"
                                : "border-ink/10 bg-white hover:border-teal-500"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium text-ink group-hover:text-teal-600">
                                {s.title}
                              </h3>
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                                  on
                                    ? "border-teal-500 bg-teal-500 text-white"
                                    : "border-ink/25 text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                            </div>
                            {s.description && (
                              <p className="mt-1 line-clamp-2 text-sm text-ink/60">
                                {s.description}
                              </p>
                            )}
                            <div className="mt-3 flex items-center justify-between">
                              <span className="font-semibold text-ink">
                                {s.billing === "mensal"
                                  ? `R$ ${(s.monthlyPrice ?? 0).toFixed(2)}/mês`
                                  : `R$ ${s.price.toFixed(2)}`}
                              </span>
                              <span className="text-xs text-ink/50">
                                {s.durationMinutes} min
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {selectedServices.length > 0 && (
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-sand/60 px-4 py-3">
                        <div className="min-w-0 text-sm">
                          <p className="font-medium text-ink">
                            {selectedServices.length} serviço
                            {selectedServices.length !== 1 ? "s" : ""} ·{" "}
                            {totalDuration} min
                          </p>
                          <p className="truncate text-xs text-ink/50">
                            {selectedServices.map((s) => s.title).join(" + ")}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-ink">
                          R$ {totalPrice.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {totalDeposit > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Este agendamento pede um{" "}
                        <span className="font-semibold">
                          sinal de R$ {totalDeposit.toFixed(2)}
                        </span>{" "}
                        para reduzir faltas. O valor é acertado com o
                        estabelecimento e abatido do total.
                      </div>
                    )}

                    {selectedServices.length === 1 &&
                      selectedServices[0].kind === "aula" &&
                      selectedServices[0].billing === "mensal" && (
                        <div className="mt-3 rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                          <span className="font-semibold">
                            Plano mensal: R${" "}
                            {(selectedServices[0].monthlyPrice ?? 0).toFixed(2)}
                            /mês
                          </span>
                          . Você está contratando um plano recorrente — o valor
                          mensal é cobrado uma vez por mês, não por aula.
                        </div>
                      )}

                    <button
                      onClick={() =>
                        selectedServices.length > 0 && setStep("slot")
                      }
                      disabled={selectedServices.length === 0}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
                    >
                      Continuar
                    </button>
                  </>
                )}
              </>
            )}

            {/* ETAPA 2 — data + horários */}
            {step === "slot" && (
              <div className="space-y-5">
                {selectedServices.length > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-sand/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {selectedServices.map((s) => s.title).join(" + ")}
                      </p>
                      <p className="text-xs text-ink/50">
                        {totalDuration} min
                        {selectedPro && <> · com {selectedPro.name}</>}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-ink">
                      R$ {totalPrice.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* modalidade: no estabelecimento x a domicílio */}
                {homeAvailable && (
                  <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
                    <span className="mb-2 block text-sm font-medium text-ink/70">
                      Onde você quer ser atendido?
                    </span>
                    {homeForced ? (
                      <p className="text-sm text-ink/60">
                        Este atendimento é a domicílio.
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAtHome(false)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            !atHome
                              ? "border-teal-500 bg-teal-500 text-white"
                              : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                          }`}
                        >
                          No estabelecimento
                        </button>
                        <button
                          type="button"
                          onClick={() => setAtHome(true)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            atHome
                              ? "border-teal-500 bg-teal-500 text-white"
                              : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                          }`}
                        >
                          A domicílio
                        </button>
                      </div>
                    )}

                    {atHome && (
                      <div className="mt-3">
                        {homeAddr ? (
                          <div className="space-y-2 text-sm">
                            <p className="text-ink/70">
                              {[
                                homeAddr.street,
                                homeAddr.neighborhood,
                                `${homeAddr.city}/${homeAddr.state}`,
                              ]
                                .filter(Boolean)
                                .join(" - ")}
                            </p>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-ink/70">
                                Número *
                              </span>
                              <input
                                value={homeAddr.number}
                                onChange={(e) =>
                                  setHomeAddr({
                                    ...homeAddr,
                                    number: e.target.value,
                                  })
                                }
                                placeholder="Ex: 1373 (ou S/N)"
                                className="h-10 w-40 rounded-lg border border-ink/15 px-3 outline-none focus:border-teal-500"
                              />
                            </label>
                            {!homeAddr.number.trim() && (
                              <p className="text-xs font-medium text-amber-500 dark:text-amber-400">
                                Informe o número para o endereço exato do
                                atendimento.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setHomeAddr(null);
                                setHomeCoords(null);
                              }}
                              className="text-xs font-medium text-teal-600 hover:underline"
                            >
                              Trocar endereço
                            </button>
                          </div>
                        ) : (
                          <AddressAutocomplete
                            onResolved={applyHomeAddress}
                            label="Endereço do atendimento"
                            hint="Digite a rua e escolha na lista; depois informe o número."
                          />
                        )}

                        {travelEstimate && !travelEstimate.overRadius && (
                          <p className="mt-2 text-xs text-ink/60">
                            Deslocamento ~{travelEstimate.oneWay} min cada trecho
                            · taxa estimada{" "}
                            <span className="font-semibold">
                              R$ {travelEstimate.fee.toFixed(2)}
                            </span>{" "}
                            (confirmada ao agendar).
                          </p>
                        )}
                        {travelEstimate?.overRadius && (
                          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                            Endereço fora da área de atendimento (~
                            {travelEstimate.km.toFixed(1)} km).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Data
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {days.map((d) => {
                      const active = d.value === date;
                      return (
                        <button
                          key={d.value}
                          onClick={() => setDate(d.value)}
                          className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition ${active
                            ? "border-teal-500 bg-teal-500 text-white"
                            : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                            }`}
                        >
                          <span className="text-xs capitalize">
                            {d.weekday}
                          </span>
                          <span className="text-sm font-semibold capitalize">
                            {d.day}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Horários disponíveis
                  </label>
                  {atHome && (!homeCoords || !homeNumberOk) ? (
                    <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
                      Informe o endereço e o número do atendimento acima para
                      ver os horários disponíveis.
                    </p>
                  ) : loadingSlots ? (
                    <div className="flex items-center gap-2 py-6 text-ink/50">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
                      Buscando horários...
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ink/20 p-6 text-center">
                      <p className="text-sm text-ink/50">
                        Nenhum horário disponível nesta data.
                      </p>
                      {waitlistJoined ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-700">
                          ✓ Você entrou na lista de espera
                          {selectedPro ? ` com ${selectedPro.name}` : ""}.
                          Avisaremos quando abrir uma vaga.
                        </div>
                      ) : (
                        <button
                          onClick={joinWaitlist}
                          disabled={joiningWaitlist}
                          className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-teal-500 px-5 text-sm font-semibold text-teal-600 transition hover:bg-teal-500 hover:text-white disabled:opacity-50"
                        >
                          {joiningWaitlist
                            ? "Entrando..."
                            : "Entrar na lista de espera"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {slots.map((iso) => {
                        const active = iso === selectedSlot;
                        return (
                          <button
                            key={iso}
                            onClick={() => setSelectedSlot(iso)}
                            className={`rounded-lg border py-2 text-sm font-medium transition ${active
                              ? "border-teal-500 bg-teal-500 text-white"
                              : "border-ink/15 bg-white text-ink/80 hover:border-teal-500"
                              }`}
                          >
                            {slotLabel(iso)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Repetir (recorrência) — indisponível em combo e a domicílio */}
                {selectedSlot && !isCombo && !atHome && (
                  <div className="rounded-xl border border-ink/10 p-4">
                    <label className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-sm font-medium text-ink">
                          Repetir este agendamento
                        </span>
                        <p className="text-xs text-ink/50">
                          Agende várias vezes no mesmo dia da semana e horário.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecurring((v) => !v)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${recurring ? "bg-teal-500" : "bg-ink/20"
                          }`}
                        aria-pressed={recurring}
                        aria-label="Repetir agendamento"
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${recurring ? "left-[22px]" : "left-0.5"
                            }`}
                        />
                      </button>
                    </label>

                    {recurring && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <span className="mb-1.5 block text-sm font-medium text-ink/70">
                            Frequência
                          </span>
                          <div className="flex gap-2">
                            {(["semanal", "quinzenal"] as Frequency[]).map(
                              (f) => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => setFrequency(f)}
                                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${frequency === f
                                    ? "border-teal-500 bg-teal-500 text-white"
                                    : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                                    }`}
                                >
                                  {f}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <label className="block">
                          <span className="mb-1.5 block text-sm font-medium text-ink/70">
                            Quantas vezes
                          </span>
                          <select
                            value={repetitions}
                            onChange={(e) =>
                              setRepetitions(Number(e.target.value))
                            }
                            className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                          >
                            {[2, 3, 4, 6, 8, 10, 12].map((n) => (
                              <option key={n} value={n}>
                                {n} vezes
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {selectedSlot && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Observações (opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Alguma preferência ou informação para o estabelecimento?"
                      className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                )}

                {error && (
                  <p className="text-sm font-medium text-red-500">{error}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rodapé */}
        {!done && step === "slot" && (
          <div className="border-t border-ink/10 p-5">
            {selectedSlot && selectedServices.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-ink/60">
                  {selectedServices.map((s) => s.title).join(" + ")}
                  {selectedPro && <> · {selectedPro.name}</>} ·{" "}
                  <span className="capitalize">
                    {days.find((d) => d.value === date)?.day}
                  </span>{" "}
                  às {slotLabel(selectedSlot)}
                  {recurring && !isCombo && (
                    <> · {repetitions}x {frequency}</>
                  )}
                </span>
                <span className="shrink-0 font-semibold text-ink">
                  R${" "}
                  {(
                    totalPrice * (recurring && !isCombo ? repetitions : 1) +
                    (atHome && travelEstimate ? travelEstimate.fee : 0)
                  ).toFixed(2)}
                </span>
              </div>
            )}
            {selectedSlot && atHome && travelEstimate && (
              <p className="mb-3 text-xs text-ink/50">
                Inclui taxa de deslocamento estimada de R${" "}
                {travelEstimate.fee.toFixed(2)} (confirmada ao agendar).
              </p>
            )}
            <button
              onClick={openReminder}
              disabled={
                !selectedSlot || booking || homeBlocked || !homeNumberOk
              }
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {booking
                ? "Agendando..."
                : recurring && !isCombo
                  ? `Confirmar ${repetitions} agendamentos`
                  : "Confirmar agendamento"}
            </button>
          </div>
        )}
      </div>
      {authFor && (
        <AuthModal
          onClose={() => setAuthFor(null)}
          onSuccess={() => {
            // guarda a acao; o useEffect abaixo executa quando o user chegar
            setPendingAction(authFor);
            setAuthFor(null);
          }}
        />
      )}
      {showReminder && (
        <ReminderModal
          value={reminderMinutes}
          onChange={setReminderMinutes}
          onConfirm={confirm}
          onCancel={() => {
            if (!booking) setShowReminder(false);
          }}
          saving={booking}
          confirmLabel={
            recurring && !isCombo
              ? `Confirmar ${repetitions} agendamentos`
              : "Confirmar agendamento"
          }
        />
      )}
    </div>
  );
}