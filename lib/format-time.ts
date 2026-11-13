import { parseSportTimestamp } from "@/lib/data/time";

const AMSTERDAM = "Europe/Amsterdam";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: AMSTERDAM }).format(date);
}

/** "Vandaag", "Morgen" or the weekday, relative to `nowIso`. */
export function dayLabel(iso: string, nowIso: string) {
  const when = parseSportTimestamp(iso);
  const now = new Date(nowIso);
  if (Number.isNaN(when.getTime()) || Number.isNaN(now.getTime())) return "";
  if (dayKey(when) === dayKey(now)) return "Vandaag";
  if (dayKey(when) === dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return "Morgen";
  const weekday = new Intl.DateTimeFormat("nl-NL", { weekday: "long", timeZone: AMSTERDAM }).format(when);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

/** "10:00" in Amsterdam time. */
export function clock(iso: string, addHours = 0) {
  const when = new Date(parseSportTimestamp(iso).getTime() + addHours * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: AMSTERDAM }).format(when);
}
