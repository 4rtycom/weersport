import { cookies } from "next/headers";
import { CONSENT_COOKIE, decideAdPlacement, parseConsentCookie, type AdSurface } from "@/lib/ads/policy";
import { getEntitlement } from "@/lib/billing/entitlement";
import { accountFromSession } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

/** The visitor's plan; anonymous visitors count as Basis. */
export async function visitorPlan(userId?: string | null): Promise<"basis" | "pro"> {
  const jar = await cookies();
  const id = userId ?? accountFromSession(jar.get(SESSION_COOKIE)?.value)?.id ?? null;
  return id ? getEntitlement(id).plan : "basis";
}

export async function visitorConsent() {
  const jar = await cookies();
  return parseConsentCookie(jar.get(CONSENT_COOKIE)?.value);
}

export async function resolveAdPlacement(input: { surface: AdSurface; suitabilityKind?: string | null; userId?: string | null }) {
  const consent = await visitorConsent();
  const plan = await visitorPlan(input.userId);
  const decision = decideAdPlacement({
    surface: input.surface,
    plan,
    consentGranted: consent.granted,
    suitabilityKind: input.suitabilityKind,
  });
  return { decision, consent, plan, scriptEnabled: decision.allowed };
}
