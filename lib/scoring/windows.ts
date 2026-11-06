import type { ScoreHorizon, WeatherHour } from "@/lib/data/types";

export const REQUESTED_HORIZON_HOURS = 48;
export const WINDOW_LENGTH_HOURS = 2;
export const HOUR_MS = 60 * 60 * 1000;

/**
 * Window rules used for every scored horizon.
 * Aggregation: arithmetic mean of the hour scores in the window, then Math.round (half away from zero for positives).
 * Tie-break: earliest window start in UTC. Presentation is Europe/Amsterdam; contiguity uses UTC epoch spacing.
 * A gap is any step that is not exactly one hour. Past hours and expired forecast hours are dropped, never backfilled.
 */
export const WINDOW_AGGREGATION = "gemiddelde van de uurscores in het aaneengesloten venster, afgerond";
export const WINDOW_TIE_BREAK = "vroegste start";

export type UsableHour = {
  time: string;
  temperatureC: number;
  windKmh: number;
  precipitationProbability: number;
  uvIndex: number | null;
};

function finite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function selectUsableHours(
  hours: WeatherHour[],
  now: Date,
  options?: { validUntil?: string | null; forecastExpired?: boolean },
): UsableHour[] {
  if (options?.forecastExpired) return [];
  const nowMs = now.getTime();
  const horizonEnd = nowMs + REQUESTED_HORIZON_HOURS * HOUR_MS;
  const validUntilMs = options?.validUntil ? new Date(options.validUntil).getTime() : null;
  const usable: UsableHour[] = [];
  for (const hour of hours) {
    const start = new Date(hour.time).getTime();
    if (!Number.isFinite(start)) continue;
    const end = start + HOUR_MS;
    if (end <= nowMs) continue;
    if (start >= horizonEnd) continue;
    if (validUntilMs !== null && Number.isFinite(validUntilMs) && start > validUntilMs) continue;
    if (!finite(hour.temperatureC) || !finite(hour.windKmh) || !finite(hour.precipitationProbability)) continue;
    usable.push({
      time: new Date(start).toISOString(),
      temperatureC: hour.temperatureC,
      windKmh: hour.windKmh,
      precipitationProbability: hour.precipitationProbability,
      uvIndex: hour.uvIndex === null || hour.uvIndex === undefined ? null : finite(hour.uvIndex) ? hour.uvIndex : null,
    });
  }
  usable.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const deduped: UsableHour[] = [];
  for (const hour of usable) {
    if (deduped.at(-1)?.time === hour.time) continue;
    deduped.push(hour);
  }
  return deduped;
}

export function horizonFor(usableCount: number): ScoreHorizon {
  const shortened = usableCount < REQUESTED_HORIZON_HOURS;
  return {
    requestedHours: REQUESTED_HORIZON_HOURS,
    usableHours: usableCount,
    shortened,
    note: shortened
      ? `Er zijn ${usableCount} geldige uren van de gevraagde ${REQUESTED_HORIZON_HOURS}. Het kortere bereik is de hele beschikbare horizon.`
      : `Alle ${REQUESTED_HORIZON_HOURS} gevraagde uren zijn geldig.`,
  };
}

export function contiguousWindows(hours: UsableHour[], length = WINDOW_LENGTH_HOURS): UsableHour[][] {
  const windows: UsableHour[][] = [];
  for (let index = 0; index <= hours.length - length; index += 1) {
    const group = hours.slice(index, index + length);
    let contiguous = true;
    for (let step = 1; step < group.length; step += 1) {
      const delta = new Date(group[step].time).getTime() - new Date(group[step - 1].time).getTime();
      if (delta !== HOUR_MS) {
        contiguous = false;
        break;
      }
    }
    if (contiguous) windows.push(group);
  }
  return windows;
}

export function meanRounded(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(mean);
}

export type ChosenWindow<T> = {
  hours: T[];
  score: number;
  start: string;
  end: string;
};

/** Highest window score. Equal scores keep the earliest UTC start. */
export function chooseWindow<T extends { time: string }>(
  windows: T[][],
  scoreOf: (window: T[]) => number,
): ChosenWindow<T> | null {
  let best: ChosenWindow<T> | null = null;
  for (const window of windows) {
    const score = scoreOf(window);
    const start = window[0].time;
    const end = window[window.length - 1].time;
    if (!best || score > best.score || (score === best.score && new Date(start).getTime() < new Date(best.start).getTime())) {
      best = { hours: window, score, start, end };
    }
  }
  return best;
}

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}

export function formatWindow(start: string, end: string) {
  return `${formatClock(start)}–${formatClock(end)}`;
}
