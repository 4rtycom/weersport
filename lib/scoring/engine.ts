import type { SuitabilityOutcome, WeatherHour } from "@/lib/data/types";
import { ICE_CRITICAL_SPORTS, WATER_CRITICAL_SPORTS } from "@/lib/data/types";
import { getScoreProfile, sportProfiles } from "@/lib/scoring/profiles";
import { assessOpenWater, type SwimAssessmentInput } from "@/lib/scoring/swim";
import { horizonFor, selectUsableHours } from "@/lib/scoring/windows";

export type { HourlyScorePoint } from "@/lib/data/types";

function withHorizon(outcome: SuitabilityOutcome, hours: WeatherHour[], now: Date): SuitabilityOutcome {
  return { ...outcome, horizon: horizonFor(selectUsableHours(hours, now).length) };
}

/**
 * Personal advice for one sport and one requested horizon.
 * Released scores are not produced: no profile has a validated decision rule.
 * Open water uses source gates only. Other sports do not fall back to a shared air/wind/rain weight.
 */
export function scoreSportHours(input: {
  sportId: string;
  hours: WeatherHour[];
  placeId?: string;
  spotId?: string | null;
  now?: Date;
  swim?: SwimAssessmentInput | null;
}): SuitabilityOutcome {
  const profile = getScoreProfile(input.sportId);
  const now = input.now ?? new Date();

  if (input.sportId === "openwaterzwemmen") {
    const swim = input.swim ?? {
      placeId: input.placeId ?? "",
      spotId: input.spotId ?? null,
      spotClass: "missing" as const,
      waterKind: null,
      coverage: "unlinked" as const,
      readings: [],
      now,
    };
    const assessment = assessOpenWater(swim);
    return withHorizon(
      {
        kind: "NO_SCORE",
        modelVersion: assessment.modelVersion,
        reason: assessment.reason,
        missing: assessment.missing,
        blocked: assessment.blocked,
        measurements: assessment.measurements,
      },
      input.hours,
      now,
    );
  }

  const withheld: SuitabilityOutcome = {
    kind: "NO_SCORE",
    modelVersion: profile.modelVersion,
    reason: profile.withheldReason,
    missing: profile.missing,
    blocked: true,
    measurements: [],
  };
  if (ICE_CRITICAL_SPORTS.has(input.sportId)) {
    return withHorizon(
      {
        ...withheld,
        reason:
          "Natuurijs wordt nooit veilig verklaard op basis van luchttemperatuur alleen. IJsdata ontbreekt → NO_SCORE.",
      },
      input.hours,
      now,
    );
  }

  if (WATER_CRITICAL_SPORTS.has(input.sportId)) {
    return withHorizon(withheld, input.hours, now);
  }

  return withHorizon(withheld, input.hours, now);
}

export function getSportMeta(sportId: string) {
  const profile = getScoreProfile(sportId);
  return {
    sportId: profile.sportId,
    tagline: profile.tagline,
    nextSportId: profile.nextSportId,
    factors: profile.factors,
    caveats: profile.caveats,
    modelVersion: profile.modelVersion,
    personalAdvice: profile.personalAdvice,
    explanation: profile.explanation,
  };
}

export function listProfileSportIds() {
  return Object.keys(sportProfiles);
}
