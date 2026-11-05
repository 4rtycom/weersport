/**
 * Open-Meteo stamps with `timezone=Europe/Amsterdam` are wall-clock strings
 * without an offset (`2026-11-05T14:00`). `new Date` reads those as the host
 * zone, so a UTC server shifts both labels and which hour counts as current.
 */

const AMSTERDAM = "Europe/Amsterdam";

function hasZone(iso: string) {
  return /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
}

function amsterdamOffsetMs(utcMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AMSTERDAM,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") % 24,
    value("minute"),
    value("second"),
  );
  return asUtc - utcMs;
}

export function forecastInstant(iso: string) {
  if (hasZone(iso)) return new Date(iso).getTime();
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso);
  if (!match) return new Date(iso).getTime();
  const wallAsUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  const firstOffset = amsterdamOffsetMs(wallAsUtc);
  let utc = wallAsUtc - firstOffset;
  const secondOffset = amsterdamOffsetMs(utc);
  if (secondOffset !== firstOffset) utc = wallAsUtc - secondOffset;
  return utc;
}

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AMSTERDAM,
  }).format(forecastInstant(iso));
}

export function formatHour(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    timeZone: AMSTERDAM,
  }).format(forecastInstant(iso));
}
