import { createHmac, timingSafeEqual } from "node:crypto";
import { eventSecret } from "@/lib/sponsoring/constants";
import { isIsoDate } from "@/lib/sponsoring/period";
import { sports } from "@/lib/sports";

const CONTROL = /[\u0000-\u001f\u007f]/;

export function plainText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function validateDestination(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Bestemmingslink is ongeldig.");
  const raw = value.trim();
  if (!raw) return null;
  if (CONTROL.test(raw) || /\s/.test(raw)) throw new Error("Bestemmingslink is ongeldig.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Bestemmingslink is ongeldig.");
  }
  if (url.protocol !== "https:") throw new Error("Bestemmingslink moet https zijn.");
  if (url.username || url.password) throw new Error("Bestemmingslink is ongeldig.");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("Bestemmingslink is ongeldig.");
  }
  return url.toString();
}

export function knownSport(sportId: unknown) {
  if (typeof sportId !== "string") return null;
  return sports.find((sport) => sport.id === sportId) ?? null;
}

export function desiredStartOrNull(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || !isIsoDate(value)) return { ok: false };
  return { ok: true, value };
}

export function placeShape(placeId: unknown, placeLabel: unknown) {
  if (typeof placeId !== "string" || typeof placeLabel !== "string") return false;
  const label = plainText(placeLabel);
  return placeId.startsWith("wpl-") && placeId.length <= 80 && label.length >= 2 && label.length <= 80;
}

export type PlacementToken = {
  placementId: string;
  campaignId: string;
  sportId: string;
  placeId: string;
};

export function signPlacement(token: PlacementToken) {
  const secret = eventSecret();
  if (!secret) return null;
  const body = `${token.placementId}|${token.campaignId}|${token.sportId}|${token.placeId}`;
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function placementSignatureMatches(token: PlacementToken, signature: unknown) {
  if (typeof signature !== "string" || !signature) return false;
  const expected = signPlacement(token);
  if (!expected || expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function sponsorBlockedReason(input: {
  surface: string;
  plan: string;
  consentGranted: boolean;
  suitabilityKind?: string | null;
  score?: number | null;
  warningStatus?: string | null;
  warningCount?: number;
  weatherDemo?: boolean;
}) {
  if (input.surface !== "moment") return "surface";
  if (input.plan === "pro") return "pro";
  if (!input.consentGranted) return "consent";
  if (input.suitabilityKind !== "SCORED") return "score";
  if (typeof input.score !== "number" || !Number.isFinite(input.score)) return "score";
  if (input.warningStatus === "OFFICIAL_WARNING" || (input.warningCount ?? 0) > 0) return "safety";
  if (input.weatherDemo) return "demo";
  return null;
}
