import { PILOT_DAYS, PILOT_TIMEZONE } from "@/lib/sponsoring/constants";

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2024 || year > 2100) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function addCalendarDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Offset of `timeZone` at `instant`, in milliseconds, such that local = utc + offset. */
export function timeZoneOffsetMs(instant: Date, timeZone = PILOT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - instant.getTime();
}

/** UTC instant of local midnight for a calendar date in Europe/Amsterdam. */
export function zonedMidnightUtc(isoDate: string, timeZone = PILOT_TIMEZONE) {
  if (!isIsoDate(isoDate)) throw new Error("Ongeldige datum.");
  const [year, month, day] = isoDate.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = timeZoneOffsetMs(new Date(guess), timeZone);
  const adjusted = new Date(guess - offset);
  const offsetAtAdjusted = timeZoneOffsetMs(adjusted, timeZone);
  return new Date(guess - offsetAtAdjusted);
}

export type PilotWindow = {
  startDate: string;
  endDate: string;
  startsAt: string;
  endsAt: string;
};

/** Inclusive local start, exclusive local end, 28 calendar days later, including DST changes. */
export function pilotWindow(startDate: string): PilotWindow {
  const endDate = addCalendarDays(startDate, PILOT_DAYS);
  return {
    startDate,
    endDate,
    startsAt: zonedMidnightUtc(startDate).toISOString(),
    endsAt: zonedMidnightUtc(endDate).toISOString(),
  };
}

export function windowContains(startsAt: string, endsAt: string, now: Date) {
  const time = now.getTime();
  return time >= Date.parse(startsAt) && time < Date.parse(endsAt);
}

/**
 * Effective CPM in euro cents. €99 and 2.500 impressions → 3960 (€39,60).
 * Zero impressions return null; callers leave the field empty.
 */
export function effectiveCpmCents(priceCents: number, impressions: number) {
  if (!Number.isInteger(priceCents) || priceCents < 0) return null;
  if (!Number.isInteger(impressions) || impressions <= 0) return null;
  return Math.round((priceCents * 1000) / impressions);
}

export function formatEuroCents(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}€${euros},${rest}`;
}

export function formatEuroDot(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${euros}.${rest}`;
}

export function formatAmsterdam(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: PILOT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
