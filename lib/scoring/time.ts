/** Phase 3 — normalize forecast instants to UTC; format only in Europe/Amsterdam. */

export const AMSTERDAM_TZ = "Europe/Amsterdam";
export const FUTURE_HORIZON_MS = 48 * 60 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Normalize provider timestamps to UTC ISO-8601.
 * Bare "YYYY-MM-DDTHH:mm" values from Open-Meteo timezone=UTC are treated as UTC.
 */
export function toUtcIso(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Lege tijdstempel");
  if (/Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const ms = Date.parse(trimmed);
    if (Number.isNaN(ms)) throw new Error(`Ongeldige tijdstempel: ${input}`);
    return new Date(ms).toISOString();
  }
  const ms = Date.parse(`${trimmed}Z`);
  if (Number.isNaN(ms)) throw new Error(`Ongeldige UTC-tijdstempel: ${input}`);
  return new Date(ms).toISOString();
}

export function formatAmsterdamClock(isoUtc: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AMSTERDAM_TZ,
  }).format(new Date(isoUtc));
}

function formatAmsterdamDate(isoUtc: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeZone: AMSTERDAM_TZ,
  }).format(new Date(isoUtc));
}

export function formatAmsterdamDateTime(isoUtc: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: AMSTERDAM_TZ,
  }).format(new Date(isoUtc));
}

/** Clock span plus the Amsterdam calendar date. Repeats the date when the window crosses midnight. */
export function formatAmsterdamWindow(startUtc: string, endUtc: string) {
  const startDate = formatAmsterdamDate(startUtc);
  const endDate = formatAmsterdamDate(endUtc);
  if (startDate === endDate) {
    return `${startDate}, ${formatAmsterdamClock(startUtc)}–${formatAmsterdamClock(endUtc)}`;
  }
  return `${formatAmsterdamDateTime(startUtc)}–${formatAmsterdamDateTime(endUtc)}`;
}
