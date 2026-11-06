import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CONSENT_COOKIE, parseConsentCookie } from "@/lib/ads/policy";
import { recordSponsorEvent } from "@/lib/sponsoring/placement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const jar = await cookies();
  const consent = parseConsentCookie(jar.get(CONSENT_COOKIE)?.value);
  if (!consent.granted) {
    return NextResponse.json({ ok: false, error: "Geen toestemming." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Meting is onleesbaar." }, { status: 400 });
  try {
    const result = recordSponsorEvent(body);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch {
    return NextResponse.json({ ok: false, error: "Meting niet opgeslagen." }, { status: 400 });
  }
}

export function GET() {
  return new NextResponse(null, { status: 404 });
}
