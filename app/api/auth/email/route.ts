import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession, changeUnverifiedEmail, rollbackUnverifiedEmailChange } from "@/lib/auth/service";
import { clearDevMail, SESSION_COOKIE, writeDevMail } from "@/lib/auth/cookies";
import {
  authIsClosed,
  authUsesInbox,
  authUsesMailbox,
  CLOSED_VERIFY_MESSAGE,
} from "@/lib/auth/release";
import { ensurePhase0TokenMigration } from "@/lib/auth/token-migration";
import { sendAuthMail } from "@/lib/mail/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  ensurePhase0TokenMigration();
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return NextResponse.json({ error: "Log opnieuw in." }, { status: 401 });

  if (authIsClosed()) {
    const response = NextResponse.json({ error: CLOSED_VERIFY_MESSAGE }, { status: 503 });
    clearDevMail(response, request);
    return response;
  }

  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const result = changeUnverifiedEmail(account.id, body?.email ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const response = NextResponse.json({ ok: true, email: result.email });
  clearDevMail(response, request);

  if (authUsesInbox()) {
    const mailed = await sendAuthMail({ to: result.email, purpose: "verify", token: result.token });
    if (!mailed.ok) {
      rollbackUnverifiedEmailChange(account.id, {
        previousEmail: result.previousEmail,
        previousTokens: result.previousTokens,
        issuedEmail: result.email,
        issuedToken: result.token,
      });
      return NextResponse.json({ error: mailed.error ?? "Versturen mislukt." }, { status: 502 });
    }
  } else if (authUsesMailbox()) {
    writeDevMail(response, request, `/auth/verifieer/bevestig?token=${encodeURIComponent(result.token)}`);
  }
  return response;
}
