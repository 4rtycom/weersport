/**
 * Phase 7 — independently togglable release capabilities.
 * Each switch can be flipped without a full redeploy of unrelated systems.
 * Safety / UV panels stay available when recommendations are disabled.
 */

import { authIsClosed } from "@/lib/auth/release";
import { checkoutEnabled } from "@/lib/billing/mollie-mode";

export type CapabilityId = "registration" | "recommendations" | "checkout";

export function registrationEnabled() {
  return !authIsClosed();
}

/** Live sportscores / SCORED suitability. UV + official warnings remain. */
export function recommendationsEnabled() {
  return process.env.WEERSPORT_RECOMMENDATIONS_DISABLED !== "1";
}

export function checkoutCapabilityEnabled() {
  return checkoutEnabled();
}

export function capabilitySnapshot() {
  return {
    registration: registrationEnabled(),
    recommendations: recommendationsEnabled(),
    checkout: checkoutCapabilityEnabled(),
  };
}

export const RECOMMENDATIONS_DISABLED_REASON =
  "Live sportscores zijn tijdelijk uitgeschakeld op deze omgeving. UV en officiële waarschuwingen blijven beschikbaar.";
