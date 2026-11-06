import type { SportDecisionProfile } from "@/lib/scoring/profiles";

/** Guide copy is rendered from the same profile as a personal result. */
export function describeProfileForGuide(profile: SportDecisionProfile) {
  return {
    applied: profile.factors.filter((factor) => factor.applied),
    withheld: profile.factors.filter((factor) => !factor.applied),
    missing: profile.missing,
    requiredFields: profile.requiredFields,
    blocks: profile.blocks.filter((block) => block.applied),
    modelVersion: profile.modelVersion,
    personalAdvice: profile.personalAdvice,
    explanation: profile.explanation,
    withheldReason: profile.withheldReason,
  };
}
