import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { publicAgendaApi, AgendaMonth } from "../api/publicAgenda";
import {
  WEEKDAYS_SHORT,
  currentMonthStr,
  monthLabel,
  addMonth,
  todayStr,
} from "../lib/agenda";

// Pagina PUBLICA (sem login): divulga a agenda do mes no formato de AGENDA —
// cada dia mostra seus HORARIOS (livres em destaque, ocupados riscados). O botao
// "Agende agora" leva ao agendamento; com ?prof=, ja pre-seleciona o
// profissional; sem ele, cai no link do estabelecimento.
export function AgendaPublicPage() {
  const { establishmentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const prof = searchParams.get("prof") || undefined;
  const navigate = useNavigate();

  const [month, setMonth] = useState<string>(
    searchParams.get("mes") || currentMonthStr()
  );
  const [data, setData] = useState<AgendaMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const today = todayStr();

  useEffect(() => {
    if (!establishmentId) return;
    setLoading(true);
    publicAgendaApi
      .get(establishmentId, { prof, mes: month })
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [establishmentId, prof, month]);

  // dias com expediente, de hoje em diante
  const days = useMemo(
    () =>
      data
        ? data.days.filter(
            (d) => d.date >= today && d.working && d.slots.length > 0
          )
        : [],
    [data, today]
  );

  // destino do agendamento: link pessoal (com prof) ou do estabelecimento
  const bookingTo = prof
    ? `/estabelecimento/${establishmentId}?prof=${prof}`
    : `/estabelecimento/${establishmentId}`;
  const goToBooking = () => navigate(bookingTo);

  const title = data?.professionalName || data?.establishmentName || "Agenda";
  const subtitle = data?.professionalName
    ? data.establishmentName
    : "Agendamento online";
  const initial = title.trim().charAt(0).toUpperCase();
  const canPrev = addMonth(month, -1) >= currentMonthStr();

  const weekdayOf = (date: string) =>
    WEEKDAYS_SHORT[new Date(date + "T12:00:00").getDay()];

  if (loading && !data)
    return (
      <div className="grid min-h-screen place-items-center bg-sand text-ink/50">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
          Carregando agenda...
        </div>
      </div>
    );
  if (notFound || !data)
    return (
      <div className="grid min-h-screen place-items-center bg-sand p-6 text-center text-ink/60">
        Link inválido ou estabelecimento não encontrado.
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-sand pb-28">
      <div className="mx-auto w-full max-w-md px-4 pt-6">
        <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-xl">
          {/* Cabecalho */}
          <div className="relative overflow-hidden bg-gradient-to-br from-teal-700 to-teal-500 p-6 text-white">
            <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              {data.photo ? (
                <img
                  src={data.photo}
                  alt={title}
                  className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-white/50"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-teal-700 text-3xl font-bold ring-2 ring-white/40">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-teal-100">
                  Agenda
                </p>
                <h1 className="truncate font-display text-2xl font-bold leading-tight">
                  {title}
                </h1>
                <p className="truncate text-sm text-teal-100">{subtitle}</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {/* Navegacao de mes */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => canPrev && setMonth((m) => addMonth(m, -1))}
                disabled={!canPrev}
                aria-label="Mês anterior"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition hover:border-teal-500 hover:text-teal-600 disabled:opacity-30"
              >
                ‹
              </button>
              <span className="font-display text-lg font-bold text-ink">
                {monthLabel(month)}
              </span>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonth(m, 1))}
                aria-label="Próximo mês"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition hover:border-teal-500 hover:text-teal-600"
              >
                ›
              </button>
            </div>

            {/* Lista de dias com horarios */}
            {days.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-sand/60 p-8 text-center text-sm text-ink/50">
                Nenhum horário disponível neste mês.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-ink/5">
                {days.map((d) => {
                  const num = Number(d.date.slice(-2));
                  return (
                    <div key={d.date} className="flex gap-3 py-3">
                      {/* Badge do dia */}
                      <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-teal-50">
                        <span className="text-[11px] font-bold uppercase text-teal-600">
                          {weekdayOf(d.date)}
                        </span>
                        <span className="font-display text-2xl font-extrabold leading-none text-teal-700">
                          {num}
                        </span>
                      </div>

                      {/* Horarios */}
                      <div className="flex flex-1 flex-wrap content-center gap-1.5">
                        {d.slots.map((s) =>
                          s.free ? (
                            <button
                              key={s.t}
                              type="button"
                              onClick={goToBooking}
                              className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-600 active:scale-95"
                            >
                              {s.t}
                            </button>
                          ) : (
                            <span
                              key={s.t}
                              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-400 line-through"
                            >
                              {s.t}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legenda */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-ink/50">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-teal-500" /> Livre
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-slate-200" /> Ocupado
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-semibold text-ink/40">
          ServiçosPro
        </p>
      </div>

      {/* CTA fixo — link real (redireciona para o agendamento) */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink/10 bg-white/90 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Link
            to={bookingTo}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-lg font-extrabold text-ink shadow-lg transition hover:brightness-105 active:scale-[0.99]"
          >
            Agende agora →
          </Link>
        </div>
      </div>
    </div>
  );
}
