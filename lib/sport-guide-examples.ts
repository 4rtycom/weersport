import { scoreHour } from "@/lib/scoring/engine";
import type { SportScoreProfile } from "@/lib/scoring/profiles";

export type GuideFactor = "temperature" | "wind" | "rain";

export type GuideExampleHour = {
  label: string;
  temperatureC: number;
  windKmh: number;
  rainPct: number;
  score: number;
};

export type GuideLandExample = {
  factor: GuideFactor;
  intro: string;
  hours: [GuideExampleHour, GuideExampleHour];
  conclusion: string;
};

/** Prefer the heaviest weight; break ties rain → temperature → wind for stable demos. */
export function dominantGuideFactor(weights: SportScoreProfile["weights"]): GuideFactor {
  const ranked: GuideFactor[] = ["rain", "temperature", "wind"];
  let best: GuideFactor = "rain";
  let bestWeight = -1;
  for (const key of ranked) {
    if (weights[key] > bestWeight) {
      best = key;
      bestWeight = weights[key];
    }
  }
  return best;
}

/**
 * One-factor land demo. Values are invented; scores always come from scoreHour.
 * Hardlopen → temperature; wielrennen → wind; rain-heavy sports → rain.
 */
export function buildLandGuideExample(profile: SportScoreProfile, sportName: string): GuideLandExample {
  const factor =
    profile.sportId === "hardlopen"
      ? "temperature"
      : profile.sportId === "wielrennen"
        ? "wind"
        : dominantGuideFactor(profile.weights);

  const midTemp = Math.round((profile.idealTempC[0] + profile.idealTempC[1]) / 2);
  const midWind = Math.round((profile.idealWindKmh[0] + profile.idealWindKmh[1]) / 2);
  const calmRain = 5;

  let hourA: Omit<GuideExampleHour, "score">;
  let hourB: Omit<GuideExampleHour, "score">;
  let intro: string;
  let whyTemplate: (winner: string, loser: string, scoreA: number, scoreB: number) => string;

  if (factor === "temperature") {
    hourA = { label: "09:00", temperatureC: midTemp, windKmh: midWind, rainPct: calmRain };
    hourB = {
      label: "14:00",
      temperatureC: Math.min(34, profile.idealTempC[1] + 8),
      windKmh: midWind,
      rainPct: calmRain,
    };
    intro = `Rekenvoorbeeld met verzonnen weer. In beide uren staat er ${midWind} km/u wind en is de kans op een bui ${calmRain}%. Alleen de luchttemperatuur verandert.`;
    whyTemplate = (winner, _loser, scoreA, scoreB) =>
      `Beide uren hebben dezelfde wind en regenkans. Om ${winner} is de temperatuur dichter bij het voorkeursbereik voor ${sportName.toLowerCase()}. Daarom krijgt dat uur ${Math.max(scoreA, scoreB)} punten en het andere ${Math.min(scoreA, scoreB)}.`;
  } else if (factor === "wind") {
    hourA = { label: "09:00", temperatureC: midTemp, windKmh: midWind, rainPct: calmRain };
    hourB = {
      label: "15:00",
      temperatureC: midTemp,
      windKmh: Math.min(55, profile.idealWindKmh[1] + 18),
      rainPct: calmRain,
    };
    intro = `Rekenvoorbeeld met verzonnen weer. In beide uren is het ${midTemp} °C en is de kans op een bui ${calmRain}%. Alleen de windsnelheid verandert.`;
    whyTemplate = (winner, _loser, scoreA, scoreB) =>
      `Beide uren zijn even koel en hebben dezelfde regenkans. Om ${winner} blijft de wind dichter bij het voorkeursbereik voor ${sportName.toLowerCase()}. Daarom krijgt dat uur ${Math.max(scoreA, scoreB)} punten en het andere ${Math.min(scoreA, scoreB)}.`;
  } else {
    hourA = { label: "09:00", temperatureC: midTemp, windKmh: midWind, rainPct: 5 };
    hourB = { label: "12:00", temperatureC: midTemp, windKmh: midWind, rainPct: 65 };
    intro = `Rekenvoorbeeld met verzonnen weer. In beide uren is het ${midTemp} °C en staat er ${midWind} km/u wind. Alleen de kans op een bui verandert.`;
    whyTemplate = (winner, _loser, scoreA, scoreB) =>
      `Beide uren zijn even koel en er staat evenveel wind. Om ${winner} is de kans op een bui kleiner. Daarom krijgt dat uur ${Math.max(scoreA, scoreB)} punten en het andere ${Math.min(scoreA, scoreB)}.`;
  }

  const scoredA = scoreHour(profile, {
    time: hourA.label,
    temperatureC: hourA.temperatureC,
    windKmh: hourA.windKmh,
    precipitationProbability: hourA.rainPct,
    uvIndex: 0,
  });
  const scoredB = scoreHour(profile, {
    time: hourB.label,
    temperatureC: hourB.temperatureC,
    windKmh: hourB.windKmh,
    precipitationProbability: hourB.rainPct,
    uvIndex: 0,
  });

  const hours: [GuideExampleHour, GuideExampleHour] = [
    { ...hourA, score: scoredA.score },
    { ...hourB, score: scoredB.score },
  ];

  let conclusion: string;
  if (hours[0].score === hours[1].score) {
    conclusion = `Volgens het huidige model passen ${hours[0].label} en ${hours[1].label} even goed bij ${sportName.toLowerCase()} (${hours[0].score} / 100).`;
  } else {
    const winner = hours[0].score >= hours[1].score ? hours[0].label : hours[1].label;
    const loser = winner === hours[0].label ? hours[1].label : hours[0].label;
    conclusion = whyTemplate(winner, loser, hours[0].score, hours[1].score);
  }

  return { factor, intro, hours, conclusion };
}

export function weightsSumToOne(weights: SportScoreProfile["weights"], epsilon = 1e-9) {
  return Math.abs(weights.temperature + weights.wind + weights.rain - 1) <= epsilon;
}
