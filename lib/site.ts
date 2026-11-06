/**
 * Phase 6 — public site identity, indexing and contact destinations.
 * Canonical domain and partnership/support addresses remain Glenn decisions;
 * env vars unlock indexing and override contact mailto targets.
 */

export const SITE_NAME = "WeerSport";
export const SITE_TAGLINE = "Wat is jouw beste sportmoment?";
export const SITE_DESCRIPTION =
  "Ontdek het beste moment om buiten te sporten in Nederland. Sportspecifiek advies voor 24 buitensporten, met UV en veiligheid apart zichtbaar.";

/** Approved production host when Glenn enables public indexing. */
export const APPROVED_PUBLIC_HOST = "weersport.nl";

export function siteOrigin(): string {
  const configured = process.env.WEERSPORT_PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://127.0.0.1:3000";
}

export function siteHost(): string {
  try {
    return new URL(siteOrigin()).hostname;
  } catch {
    return "localhost";
  }
}

/**
 * Staging / previews stay noindex unless Glenn explicitly allows indexing
 * on the approved public origin.
 */
export function allowPublicIndexing(): boolean {
  if (process.env.WEERSPORT_ALLOW_INDEXING !== "1") return false;
  const host = siteHost();
  return host === APPROVED_PUBLIC_HOST || host === `www.${APPROVED_PUBLIC_HOST}`;
}

export function robotsDirective(): { index: boolean; follow: boolean } {
  const allow = allowPublicIndexing();
  return { index: allow, follow: allow };
}

export function supportEmail(): string {
  return process.env.WEERSPORT_SUPPORT_EMAIL?.trim() || "support@weersport.nl";
}

export function partnershipEmail(): string {
  return process.env.WEERSPORT_PARTNERSHIP_EMAIL?.trim() || supportEmail();
}

export function supportMailto(subject = "WeerSport support"): string {
  return `mailto:${supportEmail()}?subject=${encodeURIComponent(subject)}`;
}

export function partnershipMailto(subject = "WeerSport partnerschap"): string {
  return `mailto:${partnershipEmail()}?subject=${encodeURIComponent(subject)}`;
}

/** Public routes that may appear in the sitemap when indexing is allowed. */
export const INDEXABLE_PUBLIC_PATHS = [
  "/",
  "/sporten",
  "/privacy",
  "/voorwaarden",
  "/support",
  "/support/terugbetaling",
  "/samenwerken",
] as const;
