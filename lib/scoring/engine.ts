import type { SuitabilityFactor, SuitabilityOutcome, WeatherHour } from "@/lib/data/types";
import { ICE_CRITICAL_SPORTS, WATER_CRITICAL_SPORTS } from "@/lib/data/types";
import {
  SCORE_MODEL_VERSION,
  getScoreProfile,
  sportProfiles,
  type SportScoreProfile,
} from "@/lib/scoring/profiles";
import { formatAmsterdamDateTime, formatAmsterdamWindow } from "@/lib/scoring/time";
import {
  findPeakHour,
  rankTwoHourWindows,
  selectFutureHours,
  type ScoredInstant,
} from "@/lib/scoring/windows";

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

function prepareFutureHours(hours: WeatherHour[], nowMs: number) {
  const future = selectFutureHours(hours, nowMs);
  return future
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
      // Keep missing UV unknown — do not coerce to 0.
      uvIndex: hour.uvIndex,
    }));
}

function scoreHour(
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

export function scoreSportHours(input: {
  sportId: string;
  hours: WeatherHour[];
  waterLinked: boolean;
  swimLinked: boolean;
  /** Phase 2: town centroids cannot satisfy water/ice site claims. */
  siteSpecificCoverage?: boolean;
  coverageNote?: string;
  /** Injectable clock for fixtures / DST cases (epoch ms). */
  nowMs?: number;
}): SuitabilityOutcome {
  const profile = getScoreProfile(input.sportId);
  const siteOk = input.siteSpecificCoverage === true;
  const nowMs = input.nowMs ?? Date.now();

  if (ICE_CRITICAL_SPORTS.has(input.sportId)) {
    return {
      kind: "NO_SCORE",
      reason:
        "Natuurijs wordt nooit veilig verklaard op basis van luchttemperatuur alleen. IJsdata ontbreekt → NO_SCORE.",
      missing: ["ijsdikte", "ijskwaliteit", ...(siteOk ? [] : ["sitespecifieke ijsdekking"])],
    };
  }

  if (WATER_CRITICAL_SPORTS.has(input.sportId)) {
    const swimNeedsLink = input.sportId === "openwaterzwemmen";
    if (!siteOk) {
      return {
        kind: "NO_SCORE",
        reason:
          input.coverageNote ??
          "Een woonplaatscentroïde kan water- of zwemcondities op een meer of strand niet vaststellen → NO_SCORE.",
        missing: swimNeedsLink
          ? ["sitespecifieke waterlocatie", "zwemwaterkwaliteit"]
          : ["sitespecifieke waterlocatie", "watercondities"],
      };
    }
    if (!input.waterLinked || (swimNeedsLink && !input.swimLinked)) {
      return {
        kind: "NO_SCORE",
        reason:
          "Kritieke water- of zwemwaterdata ontbreekt. Er is geen geruststellende sportgeschiktheidsscore.",
        missing: swimNeedsLink
          ? ["watertemperatuur", "zwemwaterkwaliteit"]
          : ["watertemperatuur", "waterkwaliteit of stroming"],
      };
    }
  }

  const prepared = prepareFutureHours(input.hours, nowMs);
  if (prepared.length === 0) {
    return {
      kind: "NO_SCORE",
      reason:
        "Geen toekomstige uurlijkse weerdata binnen 48 uur. Verlopen uren worden niet hergebruikt.",
      missing: ["toekomstige uurlijkse weerdata"],
    };
  }

  const scoredHours = prepared.map((hour) => scoreHour(profile, hour));
  const curve: ScoredInstant[] = scoredHours.map((point) => ({
    time: point.time,
    score: point.score,
    temperatureC: point.temperatureC,
    windKmh: point.windKmh,
    precipitationProbability: point.precipitationProbability,
    uvIndex: point.uvIndex,
  }));

  const windows = rankTwoHourWindows(curve);
  if (windows.length === 0) {
    return {
      kind: "NO_SCORE",
      reason:
        "Geen volledig aaneengesloten 2-uursvenster in de komende 48 uur (gaten of te weinig uren).",
      missing: ["aaneengesloten 2-uursvenster"],
    };
  }

  const nowHour = scoredHours[0];
  const peak = findPeakHour(curve)!;
  const recommended = windows[0];
  const badge = badgeFor(nowHour.score);
  const factors = buildFactors(profile, nowHour.parts);
  const peakWindow = {
    start: recommended.start,
    end: recommended.end,
    peakTime: recommended.peakTime,
    peakScore: recommended.peakScore,
    label: `Aanbevolen venster · ${formatAmsterdamWindow(recommended.start, recommended.end)} · ${recommended.score}/100`,
  };

  return {
    kind: "SCORED",
    modelVersion: SCORE_MODEL_VERSION,
    score: nowHour.score,
    badge,
    now: {
      time: nowHour.time,
      score: nowHour.score,
      label: `Nu · ${formatAmsterdamDateTime(nowHour.time)} · ${nowHour.score}/100`,
    },
    peakHour: {
      time: peak.time,
      score: peak.score,
      label: `Piek-uur · ${formatAmsterdamDateTime(peak.time)} · ${peak.score}/100`,
    },
    recommendedWindow: {
      ...peakWindow,
      score: recommended.score,
    },
    peakWindow,
    bestTimeLabel: `Aanbevolen venster ${formatAmsterdamWindow(recommended.start, recommended.end)}`,
    hourly: curve,
    factors,
    tooltip: `${profile.tagline}. Nu ${nowHour.score}/100, piek-uur ${peak.score}/100, venster ${recommended.score}/100. Model ${SCORE_MODEL_VERSION}.`,
    caveats: `${profile.caveats} Gewichten zijn voorlopig tot onafhankelijke review.`,
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

/** Test helper: score land sports without safety gates. */
export function scoreLandHoursForTests(
  sportId: string,
  hours: WeatherHour[],
  nowMs: number,
): SuitabilityOutcome {
  return scoreSportHours({
    sportId,
    hours,
    waterLinked: false,
    swimLinked: false,
    siteSpecificCoverage: false,
    nowMs,
  });
}
