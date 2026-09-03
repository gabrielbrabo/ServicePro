import { useEffect, useRef, useState } from "react";
import { scheduleApi } from "../api/schedule";

// Converte um horario ISO num rotulo "HH:mm" local.
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

// Select de horario que so oferece horarios LIVRES na agenda do servico
// (endpoint freeSlots, modo admin: ignora a janela de dias do cliente). Enquanto
// nao houver servico + data escolhidos, fica desabilitado com uma dica. Assim o
// estabelecimento nunca marca num horario indisponivel.
// value/onChange trabalham com "HH:mm" — compativel com os formularios atuais.
export function FreeSlotSelect({
  serviceId,
  date,
  professionalId,
  value,
  onChange,
  className,
}: {
  serviceId?: string;
  date?: string; // YYYY-MM-DD
  professionalId?: string | null;
  value: string; // "HH:mm"
  onChange: (hhmm: string) => void;
  className?: string;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([]);
      setLoaded(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    scheduleApi
      .freeSlots(serviceId, date, professionalId || undefined, null, true)
      .then((r) => {
        if (id !== reqId.current) return;
        setSlots(r.slots);
        setLoaded(true);
      })
      .catch(() => {
        if (id !== reqId.current) return;
        setSlots([]);
        setLoaded(true);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [serviceId, date, professionalId]);

  const cls =
    className ||
    "h-10 w-full rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500";

  const times = slots.map(hhmm);
  // mantem o horario atual na lista mesmo que ja tenha saido dos livres (ex.:
  // editando um retorno antigo), para nao "sumir" do campo.
  const options = value && !times.includes(value) ? [value, ...times] : times;

  if (!serviceId || !date) {
    return (
      <select disabled className={cls} value="">
        <option value="">Escolha serviço e data</option>
      </select>
    );
  }
  if (loading) {
    return (
      <select disabled className={cls} value="">
        <option value="">Carregando horários...</option>
      </select>
    );
  }
  if (loaded && options.length === 0) {
    return (
      <select disabled className={cls} value="">
        <option value="">Sem horários livres nesta data</option>
      </select>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cls}
    >
      <option value="">Selecione...</option>
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
