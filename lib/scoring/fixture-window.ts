import type { SuitabilityFactor, SuitabilityOutcome, WeatherHour } from "@/lib/data/types";
import {
  WINDOW_AGGREGATION,
  WINDOW_TIE_BREAK,
  chooseWindow,
  contiguousWindows,
  formatClock,
  formatWindow,
  horizonFor,
  meanRounded,
  selectUsableHours,
  type UsableHour,
} from "@/lib/scoring/windows";

/**
 * Labeled fixture for window mechanics only.
 * Not a sport decision rule. Personal advice never selects this model.
 * Hour scores are supplied by the caller. This file does not define sport weights or thresholds.
 * Badge bands below exist only so a fixture result has a stable label in tests.
 */
export const FIXTURE_MODEL_VERSION = "fixture-window-v1";
export const FIXTURE_LABEL = "Gelabelde testfixture. Geen sportadvies en geen vrijgegeven beslisregel.";

function fixtureBadge(score: number): "GOED" | "MATIG" | "SLECHT" {
  if (score >= 80) return "GOED";
  if (score >= 55) return "MATIG";
  return "SLECHT";
}

export function scoreFixtureWindow(input: {
  hours: WeatherHour[];
  now: Date;
  hourScore: (hour: UsableHour) => number;
  validUntil?: string | null;
  forecastExpired?: boolean;
}): SuitabilityOutcome {
  const usable = selectUsableHours(input.hours, input.now, {
    validUntil: input.validUntil,
    forecastExpired: input.forecastExpired,
  });
  const horizon = horizonFor(usable.length);
  if (usable.length === 0) {
    return {
      kind: "NO_SCORE",
      modelVersion: FIXTURE_MODEL_VERSION,
      reason: "Alleen verstreken, onvolledige of verlopen uren. Die zijn ongeschikt en er is geen terugval.",
      missing: ["geldige uurdata"],
      blocked: true,
      horizon,
    };
  }
  const windows = contiguousWindows(usable);
  const chosen = chooseWindow(windows, (window) => meanRounded(window.map((hour) => input.hourScore(hour))));
  if (!chosen) {
    return {
      kind: "NO_SCORE",
      modelVersion: FIXTURE_MODEL_VERSION,
      reason: "Er is geen aaneengesloten venster. Losse uren met een gat ertussen vormen geen beste moment.",
      missing: ["aaneengesloten venster"],
      blocked: true,
      horizon,
    };
  }

  const hourly = usable.map((hour) => ({
    time: hour.time,
    score: input.hourScore(hour),
    temperatureC: hour.temperatureC,
    windKmh: hour.windKmh,
    precipitationProbability: hour.precipitationProbability,
    uvIndex: hour.uvIndex,
  }));
  const nowHour = usable.find((hour) => {
    const start = new Date(hour.time).getTime();
    return start <= input.now.getTime() && input.now.getTime() < start + 60 * 60 * 1000;
  });
  const factors: SuitabilityFactor[] = [
    {
      id: "venster",
      label: "Venster",
      impact: chosen.score,
      explanation: `${FIXTURE_LABEL} ${WINDOW_AGGREGATION}. Gelijke scores: ${WINDOW_TIE_BREAK}.`,
    },
  ];
  const label = `Beste moment · ${formatWindow(chosen.start, chosen.end)}`;
  return {
    kind: "SCORED",
    modelVersion: FIXTURE_MODEL_VERSION,
    score: chosen.score,
    badge: fixtureBadge(chosen.score),
    peakWindow: {
      start: chosen.start,
      end: chosen.end,
      peakTime: chosen.start,
      peakScore: chosen.score,
      label,
    },
    bestTimeLabel: label,
    hourly,
    factors,
    tooltip: `${FIXTURE_LABEL} Vensterscore ${chosen.score}.`,
    caveats: FIXTURE_LABEL,
    now: nowHour
      ? {
          time: nowHour.time,
          score: input.hourScore(nowHour),
          label: `Nu · ${formatClock(nowHour.time)}`,
        }
      : null,
    horizon,
    aggregation: WINDOW_AGGREGATION,
    tieBreak: WINDOW_TIE_BREAK,
  };
}
