/** Local-calendar date helpers. Day keys are 'YYYY-MM-DD' in the device's time zone. */

const DAY_MS = 86_400_000;

export type DayKey = string;

export function dayKey(d: Date | number): DayKey {
  const date = typeof d === 'number' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Whole calendar days from a to b (DST-safe). */
export function diffDays(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

export type Cycle = {
  /** First day of the cycle (payday). */
  start: Date;
  /** First day of the next cycle (exclusive end). */
  end: Date;
  days: number;
};

function paydayIn(year: number, month: number, payday: number): Date {
  return new Date(year, month, Math.min(payday, daysInMonth(year, month)));
}

/**
 * The salary cycle containing `date`: from this month's payday (clamped to the
 * month's length) to the next one. With payday = 1 it is the calendar month,
 * which matches the PRD formula "÷ days in current month".
 */
export function cycleFor(date: Date, payday: number): Cycle {
  const day = startOfDay(date);
  const thisPay = paydayIn(day.getFullYear(), day.getMonth(), payday);
  const start =
    day >= thisPay ? thisPay : paydayIn(day.getFullYear(), day.getMonth() - 1, payday);
  const end = paydayIn(start.getFullYear(), start.getMonth() + 1, payday);
  return { start, end, days: diffDays(start, end) };
}

export function cycleDayKeys(cycle: Cycle): DayKey[] {
  return Array.from({ length: cycle.days }, (_, i) => dayKey(addDays(cycle.start, i)));
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatHour(hour: number, minute = 0): string {
  const m = minute.toString().padStart(2, '0');
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatDate(d: Date, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const withYear = opts.year ? `${base} ${d.getFullYear()}` : base;
  return opts.weekday ? `${WEEKDAYS[d.getDay()]}, ${withYear}` : withYear;
}

export function shortWeekday(d: Date): string {
  return WEEKDAYS[d.getDay()].slice(0, 3);
}

export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
