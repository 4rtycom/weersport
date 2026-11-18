export type AdSurface =
  | "home"
  | "moment"
  | "account"
  | "guide"
  | "auth"
  | "checkout"
  | "billing"
  | "legal"
  | "other";

export type AdDecision =
  | { allowed: false; reason: string; code: "HOME" | "AUTH" | "CHECKOUT" | "BILLING" | "PRO" | "NO_SCORE" | "SURFACE" }
  | { allowed: true; reason: string; code: "BASIS_MOMENT" | "BASIS_SAVED" | "BASIS_GUIDE" };

/** Reserved height for an in-content block, so the page does not jump when an ad loads. */
export const AD_SLOT_MIN_HEIGHT_PX = 280;
/**
 * Mirror of the visitor's choice in Google's consent message. Only the sponsor measurement reads it; ads never do,
 * because Google's message itself decides what Google may do.
 */
export const CONSENT_COOKIE = "ws_consent_cookies";
export const CONSENT_VERSION = "cookies-v1";

/** Where an in-content AdSense block may appear. Google's consent message handles consent for the ads themselves. */
export function decideAdPlacement(input: {
  surface: AdSurface;
  plan: "basis" | "pro";
  suitabilityKind?: "SCORED" | "NO_SCORE" | string | null;
}): AdDecision {
  if (input.surface === "home") return { allowed: false, reason: "Geen advertenties op de homepage.", code: "HOME" };
  if (input.surface === "auth") return { allowed: false, reason: "Geen advertenties op inlogschermen.", code: "AUTH" };
  if (input.surface === "checkout" || input.surface === "billing") {
    return { allowed: false, reason: "Geen advertenties bij betalen of facturen.", code: "CHECKOUT" };
  }
  if (input.plan === "pro") return { allowed: false, reason: "Pro is advertentievrij.", code: "PRO" };
  if (input.suitabilityKind === "NO_SCORE") {
    return { allowed: false, reason: "Geen advertenties als er geen score is.", code: "NO_SCORE" };
  }
  if (input.surface === "moment" && input.suitabilityKind === "SCORED") {
    return { allowed: true, reason: "Eén blok ná score, UV, veiligheid en factoren.", code: "BASIS_MOMENT" };
  }
  if (input.surface === "account") return { allowed: true, reason: "Eén blok ná opgeslagen inhoud.", code: "BASIS_SAVED" };
  if (input.surface === "guide") return { allowed: true, reason: "Eén blok ná de uitleg.", code: "BASIS_GUIDE" };
  return { allowed: false, reason: "Hier staat geen advertentieblok.", code: "SURFACE" };
}

/**
 * Pages where full-screen vignettes must never start: links on these pages, and links that lead to them, are
 * marked with data-google-vignette="false".
 */
export const FULLSCREEN_BLOCKED_PREFIXES = [
  "/auth",
  "/checkout",
  "/account/abonnement",
  "/account/facturering",
  "/account/privacy",
  "/account/meldingen",
  "/sponsoring",
  "/meldingen",
  "/support",
  "/privacy",
  "/voorwaarden",
  "/prijzen",
] as const;

export function fullScreenAllowed(pathname: string) {
  const path = pathname.split(/[?#]/)[0] || "/";
  if (path === "/") return false;
  return !FULLSCREEN_BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** "ca-pub-123" from either "ca-pub-123" or "pub-123"; null when unset or malformed. */
export function adsenseClient(raw = process.env.NEXT_PUBLIC_ADSENSE_CLIENT): string | null {
  const value = raw?.trim() ?? "";
  const match = /^(?:ca-)?(pub-\d{10,20})$/.exec(value);
  return match ? `ca-${match[1]}` : null;
}

export function adsenseConfigured() {
  return Boolean(adsenseClient() && process.env.NEXT_PUBLIC_ADSENSE_SLOT?.trim());
}

/** The line Google expects in /ads.txt for this publisher. */
export function adsTxtLine(client = adsenseClient()) {
  return client ? `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0` : null;
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
