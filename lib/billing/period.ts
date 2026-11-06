import { QUOTA_TIMEZONE } from "@/lib/billing/quota-policy";

/** Calendar-month period keys in Europe/Amsterdam. */
export function amsterdamParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: QUOTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
  };
}

export function calendarPeriodKey(date = new Date()) {
  const { year, month } = amsterdamParts(date);
  return `${year}-${month}`;
}

export function hourBucketKey(date = new Date()) {
  const { year, month, day, hour } = amsterdamParts(date);
  return `${year}-${month}-${day}T${hour}`;
}

/**
 * Next quota reset instant: 1st of next Amsterdam month at 00:00 local,
 * encoded as a real UTC ISO timestamp (DST-safe via iterative search).
 */
export function nextCalendarResetIso(date = new Date()) {
  const { year, month } = amsterdamParts(date);
  const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
  const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
  const targetDay = "01";
  const targetMonth = String(nextMonth).padStart(2, "0");
  const targetYear = String(nextYear).padStart(4, "0");

  // Scan a UTC window covering the Amsterdam midnight boundary.
  let cursor = Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0) - 3 * 60 * 60 * 1000;
  const end = cursor + 8 * 60 * 60 * 1000;
  while (cursor <= end) {
    const parts = amsterdamParts(new Date(cursor));
    if (
      parts.year === targetYear &&
      parts.month === targetMonth &&
      parts.day === targetDay &&
      parts.hour === "00"
    ) {
      return new Date(cursor).toISOString();
    }
    cursor += 60 * 1000;
  }
  // Fallback label if search fails (should not happen).
  return `${targetYear}-${targetMonth}-01T00:00:00.000Z`;
}

export function addDaysIso(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Request fingerprint bound to user + draft + Amsterdam hour bucket. */
export function analysisFingerprint(
  userId: string,
  draft: { sportId: string; placeId: string; period: string },
  at = new Date(),
) {
  return `${userId}:${draft.sportId}:${draft.placeId}:${draft.period}:${hourBucketKey(at)}`;
}
