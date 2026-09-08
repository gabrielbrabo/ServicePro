import { AgendaDay, AgendaMonth } from "../api/publicAgenda";

// Helpers compartilhados entre a pagina publica da agenda e o banner (canvas).

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const pad = (n: number): string => String(n).padStart(2, "0");

// mes atual no formato YYYY-MM (fuso local)
export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// data de hoje no formato YYYY-MM-DD (fuso local)
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// desloca o mes (delta pode ser negativo)
export function addMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// "Setembro 2026"
export function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function freeCount(day: AgendaDay): number {
  return day.slots.reduce((n, s) => (s.free ? n + 1 : n), 0);
}

export function bookedCount(day: AgendaDay): number {
  return day.slots.reduce((n, s) => (s.free ? n : n + 1), 0);
}

export type DayStatus = "blank" | "closed" | "past" | "full" | "free";

// classifica um dia para colorir a celula do calendario
export function dayStatus(day: AgendaDay | undefined, today: string): DayStatus {
  if (!day) return "blank";
  if (day.date < today) return "past";
  if (!day.working) return "closed";
  return freeCount(day) > 0 ? "free" : "full";
}

export interface CalendarCell {
  dayNum: number | null; // null = celula vazia (offset do 1o dia)
  day?: AgendaDay;
}

// monta a matriz de semanas (linhas de 7) do mes, com offset do 1o dia da
// semana (domingo). Casa cada dia com o AgendaDay correspondente.
export function calendarWeeks(data: AgendaMonth): CalendarCell[][] {
  const [y, m] = data.month.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0=domingo
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDate = new Map(data.days.map((d) => [d.date, d]));

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ dayNum: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${pad(m)}-${pad(d)}`;
    cells.push({ dayNum: d, day: byDate.get(date) });
  }
  while (cells.length % 7 !== 0) cells.push({ dayNum: null });

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
