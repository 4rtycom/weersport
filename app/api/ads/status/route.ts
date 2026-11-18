import { NextResponse } from "next/server";
import { adsenseClient, adsenseConfigured } from "@/lib/ads/policy";
import { visitorPlan } from "@/lib/ads/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether this visitor gets ads: AdSense set up and not Pro. Consent is handled by Google's certified message. */
export async function GET() {
  const plan = await visitorPlan();
  const ads = adsenseConfigured() && plan !== "pro";
  return NextResponse.json(
    { ads, client: ads ? adsenseClient() : null },
    { headers: { "cache-control": "private, no-store" } },
  );
}
