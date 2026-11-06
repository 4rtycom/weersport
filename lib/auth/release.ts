/**
 * Phase 0 — public release auth containment.
 *
 * Until transactional inbox delivery exists (Phase 1), production and untrusted
 * preview targets must not expose recovery/verification credentials via HTML,
 * JSON, cookies or redirects. Local disposable tests may opt into a dev mailbox.
 */

export type AuthDeliveryMode = "closed" | "dev-mailbox";

export function isVercelProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function authDeliveryMode(): AuthDeliveryMode {
  if (isVercelProduction()) return "closed";
  if (process.env.WEERSPORT_FORCE_AUTH_CLOSED === "1") return "closed";
  if (process.env.WEERSPORT_ALLOW_DEV_AUTH === "0") return "closed";
  // Vercel preview: closed unless explicitly allowed for disposable staging UAT.
  if (process.env.VERCEL_ENV === "preview" && process.env.WEERSPORT_ALLOW_DEV_AUTH !== "1") {
    return "closed";
  }
  if (process.env.WEERSPORT_ALLOW_DEV_AUTH === "1") return "dev-mailbox";
  // Local / non-Vercel defaults to mailbox for engineering checks.
  if (!process.env.VERCEL_ENV) return "dev-mailbox";
  return "closed";
}

export function authIsClosed() {
  return authDeliveryMode() === "closed";
}

export function assertDisposableCheckTarget(baseUrl: string | undefined) {
  if (!baseUrl) return;
  if (process.env.WEERSPORT_ALLOW_PROD_CHECK === "1") return;
  const host = new URL(baseUrl).hostname;
  if (host === "weersport.vercel.app" || host.endsWith(".vercel.app") && !host.includes("-git-")) {
    // Production alias and unmarked hosts must not run destructive check suites.
    if (host === "weersport.vercel.app") {
      throw new Error("Refusing destructive checks against production. Set WEERSPORT_ALLOW_PROD_CHECK=1 only with explicit review.");
    }
  }
}

export const CLOSED_SIGNUP_MESSAGE =
  "Accountaanmaak is tijdelijk gesloten op deze omgeving. Er is nog geen beveiligde e-mailbezorging gekoppeld.";

export const CLOSED_RECOVERY_MESSAGE =
  "Als dit adres een account heeft, volgt instructie via een beveiligd kanaal zodra e-mailbezorging actief is.";

export const CLOSED_VERIFY_MESSAGE =
  "E-mailverificatie via de browser is uitgeschakeld op deze omgeving totdat inbox-bezorging beschikbaar is.";
