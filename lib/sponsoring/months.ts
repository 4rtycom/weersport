const TIMEZONE = "Europe/Amsterdam";

export type CalendarDate = { year: number; month: number; day: number };

export function amsterdamDate(date: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function isoDate(date: CalendarDate) {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

export function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth(year, month)) return null;
  return { year, month, day };
}

export function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day 29–31 clamps to the last day of a short month, then returns to the anchor. */
export function clampDay(year: number, month: number, anchorDay: number) {
  return Math.min(anchorDay, lastDayOfMonth(year, month));
}

export function shiftMonths(start: CalendarDate, anchorDay: number, count: number): CalendarDate {
  const cursor = new Date(Date.UTC(start.year, start.month - 1 + count, 1));
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth() + 1;
  return { year, month, day: clampDay(year, month, anchorDay) };
}

export function nextPeriodStart(periodStart: string, anchorDay: number) {
  const parsed = parseIsoDate(periodStart);
  if (!parsed) throw new Error("Ongeldige periodedatum.");
  return isoDate(shiftMonths(parsed, anchorDay, 1));
}

export function periodContains(start: string, end: string, day: string) {
  return day >= start && day < end;
}

export function formatEuroCents(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const euros = Math.floor(absolute / 100);
  const rest = String(absolute % 100).padStart(2, "0");
  return `${sign}€ ${euros.toLocaleString("nl-NL")},${rest}`;
}

export function formatPeriodLabel(start: string, endExclusive: string) {
  const end = parseIsoDate(endExclusive);
  const begin = parseIsoDate(start);
  if (!end || !begin) return start;
  const previous = new Date(Date.UTC(end.year, end.month - 1, end.day));
  previous.setUTCDate(previous.getUTCDate() - 1);
  const lastDay = isoDate({
    year: previous.getUTCFullYear(),
    month: previous.getUTCMonth() + 1,
    day: previous.getUTCDate(),
  });
  return `${dutchDate(start)} t/m ${dutchDate(lastDay)}`;
}

function dutchDate(iso: string) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)));
}

export function amsterdamToday(now = new Date()) {
  return isoDate(amsterdamDate(now));
}
