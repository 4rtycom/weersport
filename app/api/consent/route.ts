import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CONSENT_COOKIE, CONSENT_VERSION, parseConsentCookie } from "@/lib/ads/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieSecurity(request: Request) {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-proto");
  const secure = forwarded === "https" || url.protocol === "https:";
  return secure;
}

export async function GET() {
  const jar = await cookies();
  const consent = parseConsentCookie(jar.get(CONSENT_COOKIE)?.value);
  return NextResponse.json({ consent });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    granted?: boolean;
    reset?: boolean;
  } | null;

  // Withdrawal / review: clear cookie so the compact banner returns without a full product reload race.
  if (body?.reset === true) {
    const response = NextResponse.json({
      consent: { granted: false, version: CONSENT_VERSION, decidedAt: null },
      reset: true,
    });
    response.headers.append(
      "set-cookie",
      [
        `${CONSENT_COOKIE}=`,
        "Path=/",
        "Max-Age=0",
        "SameSite=Lax",
        ...(cookieSecurity(request) ? ["Secure"] : []),
      ].join("; "),
    );
    return response;
  }

  if (typeof body?.granted !== "boolean") {
    return NextResponse.json({ error: "Consentkeuze ontbreekt." }, { status: 400 });
  }
  const payload = JSON.stringify({
    granted: body.granted,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  });
  const response = NextResponse.json({
    consent: parseConsentCookie(payload),
  });
  response.headers.append(
    "set-cookie",
    [
      `${CONSENT_COOKIE}=${encodeURIComponent(payload)}`,
      "Path=/",
      `Max-Age=${60 * 60 * 24 * 180}`,
      "SameSite=Lax",
      ...(cookieSecurity(request) ? ["Secure"] : []),
    ].join("; "),
  );
  return response;
}
