/** Europe/Amsterdam wall times without an offset are not UTC. */

const HAS_OFFSET = /(?:[zZ]|[+-]\d{2}:\d{2})$/;

function amsterdamOffsetMinutes(utcMillis: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMillis));
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
  return Math.round((asUtc - utcMillis) / 60000);
}

export function parseSportTimestamp(value: string): Date {
  const trimmed = value.trim();
  if (HAS_OFFSET.test(trimmed)) return new Date(trimmed);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
  if (!match) return new Date(trimmed);
  const wall = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  const offset = amsterdamOffsetMinutes(wall);
  let utc = wall - offset * 60000;
  const corrected = amsterdamOffsetMinutes(utc);
  if (corrected !== offset) utc = wall - corrected * 60000;
  return new Date(utc);
}

export const SCORE_WINDOW_MS = 48 * 60 * 60 * 1000;
export const SCORE_GRACE_MS = 60 * 60 * 1000;

export function inScoreWindow(time: string, now = Date.now()): boolean {
  const stamp = parseSportTimestamp(time).getTime();
  if (Number.isNaN(stamp)) return false;
  return stamp >= now - SCORE_GRACE_MS && stamp <= now + SCORE_WINDOW_MS;
}
