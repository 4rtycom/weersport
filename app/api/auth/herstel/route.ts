import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/service";
import { clearDevMail, writeDevMail } from "@/lib/auth/cookies";
import { authIsClosed, authUsesInbox, authUsesMailbox } from "@/lib/auth/release";
import { ensurePhase0TokenMigration } from "@/lib/auth/token-migration";
import { sendAuthMail } from "@/lib/mail/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Always returns the same confirmation path for known and unknown emails.
 * Inbox mode sends mail only when an account exists; never leaks that fact.
 */
export async function POST(request: Request) {
  ensurePhase0TokenMigration();
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const response = NextResponse.json({ next: "/auth/herstel/verstuurd" });
  clearDevMail(response, request);

  if (authIsClosed()) {
    return response;
  }

  const issued = requestPasswordReset(body?.email ?? "");
  if (!issued) return response;

  if (authUsesInbox()) {
    await sendAuthMail({ to: issued.email, purpose: "reset", token: issued.token });
    return response;
  }

  if (authUsesMailbox()) {
    writeDevMail(response, request, `/auth/herstel/nieuw?token=${encodeURIComponent(issued.token)}`);
  }
  return response;
}
