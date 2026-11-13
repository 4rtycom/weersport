import { parseSportTimestamp } from "@/lib/data/time";
import type { HourlyScorePoint, WeatherHour } from "@/lib/data/types";
import { scoreSportHours } from "@/lib/scoring/engine";
import type { AlertDays } from "@/lib/alerts/store";

const AMSTERDAM = "Europe/Amsterdam";

export type AlertWindow = {
  /** Amsterdam calendar date of the window, used to send at most one alert per day. */
  date: string;
  dayLabel: string;
  start: string;
  label: string;
  score: number;
  hour: HourlyScorePoint;
};

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: AMSTERDAM,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: get("weekday"), hour: Number(get("hour")) };
}

function dayLabel(when: Date, now: Date) {
  const target = localParts(when).date;
  if (target === localParts(now).date) return "Vandaag";
  if (target === localParts(new Date(now.getTime() + 864e5)).date) return "Morgen";
  const name = new Intl.DateTimeFormat("nl-NL", { weekday: "long", timeZone: AMSTERDAM }).format(when);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The best hour that meets the alert: at least `minScore`, at least an hour from now, in daylight-ish hours
 * (07:00–21:00) and, for weekend alerts, on Saturday or Sunday. Null when nothing qualifies or the sport has no score.
 */
export function findAlertWindow(input: {
  sportId: string;
  hours: WeatherHour[];
  minScore: number;
  days: AlertDays;
  now?: Date;
}): AlertWindow | null {
  const now = input.now ?? new Date();
  const outcome = scoreSportHours({ sportId: input.sportId, hours: input.hours });
  if (outcome.kind !== "SCORED") return null;
  const candidates = outcome.hourly.filter((point) => {
    const when = parseSportTimestamp(point.time);
    if (when.getTime() < now.getTime() + 60 * 60 * 1000) return false;
    const local = localParts(when);
    if (local.hour < 7 || local.hour > 19) return false;
    if (input.days === "weekend" && local.weekday !== "Sat" && local.weekday !== "Sun") return false;
    return point.score >= input.minScore;
  });
  if (candidates.length === 0) return null;
  const best = candidates.reduce((top, point) => (point.score > top.score ? point : top), candidates[0]);
  const start = parseSportTimestamp(best.time);
  const fmt = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: AMSTERDAM });
  return {
    date: localParts(start).date,
    dayLabel: dayLabel(start, now),
    start: start.toISOString(),
    label: `${fmt.format(start)}–${fmt.format(new Date(start.getTime() + 2 * 3600e3))}`,
    score: best.score,
    hour: best,
  };
}
