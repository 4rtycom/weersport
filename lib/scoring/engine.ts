import type { SuitabilityFactor, SuitabilityOutcome, WeatherHour } from "@/lib/data/types";
import { ICE_CRITICAL_SPORTS, WATER_CRITICAL_SPORTS } from "@/lib/data/types";
import { inScoreWindow, parseSportTimestamp } from "@/lib/data/time";
import {
  SCORE_MODEL_VERSION,
  getScoreProfile,
  sportProfiles,
  type SportScoreProfile,
} from "@/lib/scoring/profiles";

export type HourlyScorePoint = {
  time: string;
  score: number;
  temperatureC: number;
  windKmh: number;
  precipitationProbability: number;
  uvIndex: number | null;
};

export type ScoredSuitability = Extract<SuitabilityOutcome, { kind: "SCORED" }>;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreBand(value: number, ideal: [number, number], soft = 8) {
  const [low, high] = ideal;
  if (value >= low && value <= high) return 100;
  if (value < low) {
    const distance = low - value;
    return clamp(100 - (distance / soft) * 70);
  }
  const distance = value - high;
  return clamp(100 - (distance / soft) * 70);
}

/** Rain proxy from Open-Meteo precipitation probability (0–100). */
function rainScore(probability: number, sensitivity: SportScoreProfile["rainSensitivity"]) {
  if (probability <= 5) return 100;
  if (sensitivity === "low") {
    if (probability < 25) return 90;
    if (probability < 50) return 75;
    if (probability < 75) return 58;
    return clamp(40 - (probability - 75) * 0.6);
  }
  if (sensitivity === "medium") {
    if (probability < 15) return 88;
    if (probability < 35) return 70;
    if (probability < 60) return 48;
    return clamp(28 - (probability - 60) * 0.5);
  }
  if (probability < 10) return 80;
  if (probability < 25) return 55;
  if (probability < 45) return 35;
  return clamp(18 - (probability - 45) * 0.35);
}

function usableHours(hours: WeatherHour[]) {
  const now = Date.now();
  return hours
    .filter((hour) => inScoreWindow(hour.time, now))
    .filter(
      (hour) =>
        hour.temperatureC !== null &&
        hour.windKmh !== null &&
        hour.precipitationProbability !== null,
    )
    .map((hour) => ({
      time: hour.time,
      temperatureC: hour.temperatureC as number,
      windKmh: hour.windKmh as number,
      precipitationProbability: hour.precipitationProbability as number,
      uvIndex: hour.uvIndex === undefined ? null : hour.uvIndex,
    }));
}

export function scoreHour(
  profile: SportScoreProfile,
  hour: {
    time: string;
    temperatureC: number;
    windKmh: number;
    precipitationProbability: number;
    uvIndex: number | null;
  },
) {
  const temperature = scoreBand(hour.temperatureC, profile.idealTempC, 10);
  const wind = scoreBand(hour.windKmh, profile.idealWindKmh, 12);
  const rain = rainScore(hour.precipitationProbability, profile.rainSensitivity);
  const score = clamp(
    temperature * profile.weights.temperature +
      wind * profile.weights.wind +
      rain * profile.weights.rain,
  );
  return {
    time: hour.time,
    score: Math.round(score),
    temperatureC: hour.temperatureC,
    windKmh: hour.windKmh,
    precipitationProbability: hour.precipitationProbability,
    uvIndex: hour.uvIndex,
    parts: { temperature, wind, rain },
  };
}

function badgeFor(score: number): ScoredSuitability["badge"] {
  if (score >= 80) return "GOED";
  if (score >= 55) return "MATIG";
  return "SLECHT";
}

function buildFactors(
  profile: SportScoreProfile,
  parts: { temperature: number; wind: number; rain: number },
): SuitabilityFactor[] {
  return profile.factors
    .map((factor) => {
      let impact = 70;
      if (factor.id.includes("temp") || factor.id === "temperatuur") impact = parts.temperature;
      else if (factor.id.includes("wind") || factor.id === "rijwind" || factor.id === "windstoten") {
        impact = parts.wind;
      } else if (factor.id.includes("regen") || factor.id === "regen") impact = parts.rain;
      else if (factor.id === "water" || factor.id === "ijs" || factor.id === "zwemwater") impact = 35;
      return {
        id: factor.id,
        label: factor.label,
        impact: Math.round(impact),
        explanation: factor.explanation,
      };
    })
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 3);
}

function findPeak(points: HourlyScorePoint[]) {
  let best = points[0];
  for (const point of points) {
    if (point.score > best.score) best = point;
  }
  const idx = points.findIndex((point) => point.time === best.time);
  const startIdx = Math.max(0, idx - 1);
  const endIdx = Math.min(points.length - 1, idx + 1);
  return {
    start: points[startIdx].time,
    end: points[endIdx].time,
    peakScore: best.score,
    peakTime: best.time,
  };
}

function formatClock(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(parseSportTimestamp(iso));
}

function formatWindow(start: string, end: string) {
  return `${formatClock(start)}–${formatClock(end)}`;
}

export function scoreSportHours(input: {
  sportId: string;
  hours: WeatherHour[];
  /** Ignored as an approval. A linked adapter is not a water measurement. */
  waterLinked?: boolean;
  swimLinked?: boolean;
  hasAcceptedWaterMeasurement?: boolean;
}): SuitabilityOutcome {
  const profile = getScoreProfile(input.sportId);

  if (ICE_CRITICAL_SPORTS.has(input.sportId)) {
    return {
      kind: "NO_SCORE",
      reason:
        "Natuurijs wordt nooit veilig verklaard op basis van luchttemperatuur alleen. IJsdata ontbreekt → NO_SCORE.",
      missing: ["ijsdikte", "ijskwaliteit"],
    };
  }

  if (WATER_CRITICAL_SPORTS.has(input.sportId)) {
    if (input.sportId === "openwaterzwemmen") {
      return {
        kind: "NO_SCORE",
        reason:
          "Openwaterzwemmen krijgt geen score zonder officiële zwemwaterstatus. Een watermeting is geen veilig-zwemmenclaim.",
        missing: ["officiële zwemwaterstatus"],
      };
    }
    if (!input.hasAcceptedWaterMeasurement) {
      return {
        kind: "NO_SCORE",
        reason:
          "Kritieke waterdata ontbreekt. Er is geen geruststellende sportgeschiktheidsscore.",
        missing: ["waterstand, watertemperatuur, golf of stroming op hetzelfde water"],
      };
    }
  }

  const hours = usableHours(input.hours);
  if (hours.length === 0) {
    return {
      kind: "NO_SCORE",
      reason: "Geen bruikbare uurlijkse weerdata beschikbaar voor scoring.",
      missing: ["uurlijkse weerdata"],
    };
  }

  const scoredHours = hours.map((hour) => scoreHour(profile, hour));
  const curve: HourlyScorePoint[] = scoredHours.map((point) => ({
    time: point.time,
    score: point.score,
    temperatureC: point.temperatureC,
    windKmh: point.windKmh,
    precipitationProbability: point.precipitationProbability,
    uvIndex: point.uvIndex,
  }));
  const nowScore = scoredHours[0];
  const peak = findPeak(curve);
  const badge = badgeFor(nowScore.score);
  const factors = buildFactors(profile, nowScore.parts);

  return {
    kind: "SCORED",
    modelVersion: SCORE_MODEL_VERSION,
    score: nowScore.score,
    badge,
    peakWindow: {
      start: peak.start,
      end: peak.end,
      peakTime: peak.peakTime,
      peakScore: peak.peakScore,
      label: `Beste moment · ${formatWindow(peak.start, peak.end)}`,
    },
    bestTimeLabel: `Beste moment rond ${formatClock(peak.peakTime)}`,
    hourly: curve,
    factors,
    tooltip: `${profile.tagline}. Score ${nowScore.score}/100 (${badge.toLowerCase()}). Model ${SCORE_MODEL_VERSION}.`,
    caveats: profile.caveats,
  };
}

export function getSportMeta(sportId: string) {
  const profile = getScoreProfile(sportId);
  return {
    sportId: profile.sportId,
    tagline: profile.tagline,
    nextSportId: profile.nextSportId,
    factors: profile.factors,
    caveats: profile.caveats,
    modelVersion: SCORE_MODEL_VERSION,
  };
}

export function listScoredSportIds() {
  return Object.keys(sportProfiles);
}
