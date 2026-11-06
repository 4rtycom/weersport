import { FUTURE_HORIZON_MS, ONE_HOUR_MS } from "@/lib/scoring/time";

export type ScoredInstant = {
  time: string;
  score: number;
  temperatureC: number;
  windKmh: number;
  precipitationProbability: number;
  uvIndex: number | null;
};

export type TwoHourWindow = {
  start: string;
  end: string;
  /** Arithmetic mean of the two hour scores, rounded. */
  score: number;
  peakTime: string;
  peakScore: number;
};

/**
 * Keep only future (or current) hours inside the 48h horizon.
 * Never falls back to expired hours. Gaps are allowed in the series;
 * two-hour ranking later requires exact 1h adjacency.
 */
export function selectFutureHours<T extends { time: string }>(
  hours: T[],
  nowMs = Date.now(),
  horizonMs = FUTURE_HORIZON_MS,
): T[] {
  return hours
    .filter((hour) => {
      const t = Date.parse(hour.time);
      if (Number.isNaN(t)) return false;
      return t >= nowMs && t < nowMs + horizonMs;
    })
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

/**
 * Aggregation: mean of the two contiguous hour scores.
 * Tie-break: earlier window start, then higher in-window peak.
 */
export function rankTwoHourWindows(points: ScoredInstant[]): TwoHourWindow[] {
  const windows: TwoHourWindow[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    const delta = Date.parse(second.time) - Date.parse(first.time);
    if (delta !== ONE_HOUR_MS) continue;
    const score = Math.round((first.score + second.score) / 2);
    const peakFirst = first.score >= second.score;
    windows.push({
      start: first.time,
      end: second.time,
      score,
      peakTime: peakFirst ? first.time : second.time,
      peakScore: peakFirst ? first.score : second.score,
    });
  }
  return windows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const startDiff = Date.parse(a.start) - Date.parse(b.start);
    if (startDiff !== 0) return startDiff;
    return b.peakScore - a.peakScore;
  });
}

export function findPeakHour(points: ScoredInstant[]): ScoredInstant | null {
  if (points.length === 0) return null;
  return points.reduce((best, point) => (point.score > best.score ? point : best), points[0]);
}
