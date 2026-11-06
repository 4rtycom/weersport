import type { SportDecisionProfile } from "@/lib/scoring/profiles";

/** Guide copy is rendered from the same profile as a personal result. */
export function describeProfileForGuide(profile: SportDecisionProfile) {
  return {
    applied: profile.factors.filter((factor) => factor.applied),
    withheld: profile.factors.filter((factor) => !factor.applied),
    missing: profile.missing,
    modelVersion: profile.modelVersion,
    personalAdvice: profile.personalAdvice,
    explanation: profile.explanation,
  };
}
