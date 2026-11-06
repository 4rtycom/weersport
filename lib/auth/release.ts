/**
 * Phase 0/1 — auth delivery modes.
 *
 * - closed: no signup/recovery token delivery (public until inbox works)
 * - inbox: transactional mail (Resend) or staging log driver — never browser cookies
 * - mailbox: local disposable browser mailbox (WEERSPORT_ALLOW_DEV_AUTH), never production
 */

import { mailConfigured } from "@/lib/mail/send";

export type AuthDeliveryMode = "closed" | "inbox" | "mailbox";

export function isVercelProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function authDeliveryMode(): AuthDeliveryMode {
  if (process.env.WEERSPORT_FORCE_AUTH_CLOSED === "1") return "closed";
  if (isVercelProduction()) {
    return mailConfigured() ? "inbox" : "closed";
  }
  if (mailConfigured()) return "inbox";
  if (process.env.WEERSPORT_ALLOW_DEV_AUTH === "0") return "closed";
  if (process.env.VERCEL_ENV === "preview" && process.env.WEERSPORT_ALLOW_DEV_AUTH !== "1") {
    return "closed";
  }
  if (process.env.WEERSPORT_ALLOW_DEV_AUTH === "1") return "mailbox";
  if (!process.env.VERCEL_ENV) return "mailbox";
  return "closed";
}

export function authIsClosed() {
  return authDeliveryMode() === "closed";
}

export function authUsesInbox() {
  return authDeliveryMode() === "inbox";
}

export function authUsesMailbox() {
  return authDeliveryMode() === "mailbox";
}

export function assertDisposableCheckTarget(baseUrl: string | undefined) {
  if (!baseUrl) return;
  if (process.env.WEERSPORT_ALLOW_PROD_CHECK === "1") return;
  const host = new URL(baseUrl).hostname;
  if (host === "weersport.vercel.app") {
    throw new Error(
      "Refusing destructive checks against production. Set WEERSPORT_ALLOW_PROD_CHECK=1 only with explicit review.",
    );
  }
}

export const CLOSED_SIGNUP_MESSAGE =
  "Accountaanmaak is tijdelijk gesloten op deze omgeving. Er is nog geen beveiligde e-mailbezorging gekoppeld.";

export const CLOSED_RECOVERY_MESSAGE =
  "Als dit adres een account heeft, volgt instructie via een beveiligd kanaal zodra e-mailbezorging actief is.";

export const CLOSED_VERIFY_MESSAGE =
  "E-mailverificatie via de browser is uitgeschakeld op deze omgeving totdat inbox-bezorging beschikbaar is.";
