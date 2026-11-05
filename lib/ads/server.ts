import { cookies } from "next/headers";
import { CONSENT_COOKIE, decideAdPlacement, parseConsentCookie, type AdSurface } from "@/lib/ads/policy";
import { getEntitlement } from "@/lib/billing/entitlement";
import { accountFromSession } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

export async function resolveAdPlacement(input: {
  surface: AdSurface;
  suitabilityKind?: string | null;
  userId?: string | null;
}) {
  const jar = await cookies();
  const consent = parseConsentCookie(jar.get(CONSENT_COOKIE)?.value);
  let plan: "basis" | "pro" = "basis";
  const userId =
    input.userId ??
    accountFromSession(jar.get(SESSION_COOKIE)?.value)?.id ??
    null;
  if (userId) {
    plan = getEntitlement(userId).plan;
  }
  const decision = decideAdPlacement({
    surface: input.surface,
    plan,
    consentGranted: consent.granted,
    suitabilityKind: input.suitabilityKind,
  });
  return {
    decision,
    consent,
    plan,
    scriptEnabled: decision.allowed && consent.granted,
  };
}
