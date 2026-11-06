import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession, confirmPrototypeVerification, resendVerification } from "@/lib/auth/service";
import { clearDevMail, SESSION_COOKIE, writeDevMail } from "@/lib/auth/cookies";
import { authIsClosed, CLOSED_VERIFY_MESSAGE } from "@/lib/auth/release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return NextResponse.json({ error: "Log opnieuw in." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { prototype?: boolean } | null;

  if (authIsClosed()) {
    const response = NextResponse.json({ error: CLOSED_VERIFY_MESSAGE }, { status: 503 });
    clearDevMail(response, request);
    return response;
  }

  if (body?.prototype) {
    const verified = confirmPrototypeVerification(account.id);
    if (!verified) {
      return NextResponse.json({ error: "Vraag eerst een nieuwe verificatiemail aan." }, { status: 400 });
    }
    return NextResponse.json({ next: "/auth/hervat" });
  }
  const token = resendVerification(account.id);
  if (!token) return NextResponse.json({ error: "Dit adres is al geverifieerd.", next: "/auth/hervat" });
  const response = NextResponse.json({ ok: true });
  writeDevMail(response, request, `/auth/verifieer/bevestig?token=${encodeURIComponent(token)}`);
  return response;
}
