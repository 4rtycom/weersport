import { NextResponse } from "next/server";
import { recordAffiliateMeasure } from "@/lib/affiliate/select";
import { parseConsentCookie, CONSENT_COOKIE } from "@/lib/ads/policy";
import { amsterdamToday } from "@/lib/sponsoring/months";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const raw = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
  const consent = parseConsentCookie(raw ? decodeURIComponent(raw) : null);
  if (!consent.granted) return NextResponse.json({ error: "Meting vraagt toestemming." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    placementId?: string;
    kind?: string;
    offerId?: string;
    sportId?: string;
  } | null;
  if (!body?.placementId || (body.kind !== "impression" && body.kind !== "click") || !body.offerId || !body.sportId) {
    return NextResponse.json({ error: "Meting is onvolledig." }, { status: 400 });
  }
  const result = recordAffiliateMeasure({
    placementId: body.placementId,
    kind: body.kind,
    offerId: body.offerId,
    sportId: body.sportId,
    day: amsterdamToday(),
  });
  return NextResponse.json({ ok: true, duplicate: result.duplicate });
}
