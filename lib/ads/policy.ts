export type AdSurface =
  | "home"
  | "moment"
  | "account"
  | "auth"
  | "checkout"
  | "billing"
  | "legal"
  | "other";

export type AdDecision =
  | { allowed: false; reason: string; code: "HOME" | "AUTH" | "CHECKOUT" | "BILLING" | "PRO" | "NO_SCORE" | "NO_CONSENT" | "SURFACE" }
  | { allowed: true; reason: string; code: "BASIS_MOMENT" | "BASIS_SAVED" };

export const AD_SLOT_MIN_HEIGHT_PX = 120;
export const CONSENT_COOKIE = "ws_consent_ads";
export const CONSENT_VERSION = "ads-v1";

export function decideAdPlacement(input: {
  surface: AdSurface;
  plan: "basis" | "pro";
  consentGranted: boolean;
  suitabilityKind?: "SCORED" | "NO_SCORE" | string | null;
}): AdDecision {
  if (input.surface === "home") {
    return { allowed: false, reason: "Geen advertenties op de homepage.", code: "HOME" };
  }
  if (input.surface === "auth") {
    return { allowed: false, reason: "Geen advertenties op auth-schermen.", code: "AUTH" };
  }
  if (input.surface === "checkout" || input.surface === "billing") {
    return { allowed: false, reason: "Geen advertenties op checkout of facturering.", code: "CHECKOUT" };
  }
  if (input.plan === "pro") {
    return { allowed: false, reason: "Pro is advertentievrij.", code: "PRO" };
  }
  if (input.suitabilityKind === "NO_SCORE") {
    return { allowed: false, reason: "Geen advertenties op kritieke NO_SCORE-schermen.", code: "NO_SCORE" };
  }
  if (!input.consentGranted) {
    return { allowed: false, reason: "Geen advertentieverzoek vóór EER-consent.", code: "NO_CONSENT" };
  }
  if (input.surface === "moment" && input.suitabilityKind === "SCORED") {
    return {
      allowed: true,
      reason: "Eén Basis-slot ná score, UV, veiligheid en factoren.",
      code: "BASIS_MOMENT",
    };
  }
  if (input.surface === "account") {
    return {
      allowed: true,
      reason: "Eén Basis-slot ná opgeslagen content.",
      code: "BASIS_SAVED",
    };
  }
  return { allowed: false, reason: "Dit oppervlak heeft geen goedgekeurd ad-slot.", code: "SURFACE" };
}

export function parseConsentCookie(raw: string | undefined | null): {
  granted: boolean;
  version: string;
  decidedAt: string | null;
} {
  if (!raw) return { granted: false, version: CONSENT_VERSION, decidedAt: null };
  try {
    const parsed = JSON.parse(raw) as { granted?: boolean; version?: string; decidedAt?: string };
    if (parsed.version !== CONSENT_VERSION) {
      return { granted: false, version: CONSENT_VERSION, decidedAt: null };
    }
    return {
      granted: Boolean(parsed.granted),
      version: CONSENT_VERSION,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : null,
    };
  } catch {
    return { granted: false, version: CONSENT_VERSION, decidedAt: null };
  }
}

export function adsenseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT && process.env.NEXT_PUBLIC_ADSENSE_SLOT);
}
