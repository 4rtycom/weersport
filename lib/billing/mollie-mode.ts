import { isVercelProduction } from "@/lib/auth/release";

/**
 * Phase 5 — explicit Mollie billing modes.
 *
 * - disabled: checkout refused (missing/invalid key, or forced)
 * - sandbox-local: no API key; local simulate/refund UAT only
 * - test: MOLLIE_API_KEY starts with test_
 * - live: MOLLIE_API_KEY starts with live_
 *
 * Production: only a valid live_ key enables checkout. Absent or incorrect keys disable it.
 */

export type MollieBillingMode = "disabled" | "sandbox-local" | "test" | "live";

export function rawMollieApiKey() {
  return process.env.MOLLIE_API_KEY?.trim() || "";
}

export function billingMode(): MollieBillingMode {
  if (process.env.WEERSPORT_BILLING_DISABLED === "1") return "disabled";
  const key = rawMollieApiKey();
  if (!key) {
    // Production must never fall open to sandbox checkout.
    if (isVercelProduction()) return "disabled";
    return "sandbox-local";
  }
  if (key.startsWith("live_")) {
    return "live";
  }
  if (key.startsWith("test_")) {
    if (isVercelProduction() && process.env.WEERSPORT_ALLOW_MOLLIE_TEST !== "1") {
      return "disabled";
    }
    return "test";
  }
  // Incorrect / unrecognized key shape → fail closed.
  return "disabled";
}

export function checkoutEnabled() {
  const mode = billingMode();
  return mode === "sandbox-local" || mode === "test" || mode === "live";
}

export function usesMollieApi() {
  const mode = billingMode();
  return mode === "test" || mode === "live";
}

export function billingModeLabel(mode = billingMode()) {
  switch (mode) {
    case "live":
      return "live";
    case "test":
      return "test";
    case "sandbox-local":
      return "sandbox-local";
    default:
      return "disabled";
  }
}

export const CHECKOUT_DISABLED_MESSAGE =
  "Pro-checkout is uitgeschakeld: Mollie-sleutel ontbreekt, is ongeldig, of billing staat uit. Glenn moet test_/live_ keys en merchantconfiguratie goedkeuren vóór echte betalingen.";
