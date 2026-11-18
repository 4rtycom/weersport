import { NextResponse } from "next/server";
import { adsenseClient, adsenseConfigured } from "@/lib/ads/policy";
import { visitorConsent, visitorPlan } from "@/lib/ads/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether this visitor gets ads: AdSense set up, not Pro, and optional cookies accepted in our own banner. */
export async function GET() {
  const [plan, consent] = await Promise.all([visitorPlan(), visitorConsent()]);
  const ads = adsenseConfigured() && plan !== "pro" && consent.granted;
  return NextResponse.json(
    { ads, client: ads ? adsenseClient() : null },
    { headers: { "cache-control": "private, no-store" } },
  );
}
