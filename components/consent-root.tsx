import { cookies } from "next/headers";
import { ConsentBanner } from "@/components/consent-banner";
import { CONSENT_COOKIE, parseConsentCookie } from "@/lib/ads/policy";

export async function ConsentRoot() {
  const jar = await cookies();
  const consent = parseConsentCookie(jar.get(CONSENT_COOKIE)?.value);
  return <ConsentBanner initialDecided={Boolean(consent.decidedAt)} />;
}
