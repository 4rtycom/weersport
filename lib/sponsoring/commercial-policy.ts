/**
 * Phase 00 policy, fixed before the new surfaces render.
 *
 * Static sponsor list and a first-party affiliate card (no third-party script):
 * Basis only, on a scored moment, without an official warning and without demo
 * or test weather. Cookie consent is not required for that display. Pro stays
 * ad-free, including these paid blocks. NO_SCORE and official warnings follow
 * the stricter existing safety block, even where a Figma frame still shows a
 * static list.
 *
 * Impression and click beacons, and any external script, still require consent.
 * AdSense keeps decideAdPlacement. A sponsorship payment never grants Pro.
 * Old campaign creatives are not rendered next to this surface.
 */
export type CommercialBlockReason =
  | "surface"
  | "pro"
  | "score"
  | "safety"
  | "demo"
  | "flag"
  | null;

export function commercialBlockReason(input: {
  surface: string;
  plan: string;
  suitabilityKind?: string | null;
  warningStatus?: string | null;
  warningCount?: number;
  weatherDemo?: boolean;
  weatherStatus?: string | null;
}): CommercialBlockReason {
  if (input.surface !== "moment") return "surface";
  if (input.plan === "pro") return "pro";
  if (input.suitabilityKind !== "SCORED") return "score";
  if (input.warningStatus === "OFFICIAL_WARNING" || (input.warningCount ?? 0) > 0) return "safety";
  if (input.weatherDemo || input.weatherStatus === "TEST_ONLY") return "demo";
  return null;
}
