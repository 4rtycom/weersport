import { NextResponse } from "next/server";
import { registerAccount, saveDraft } from "@/lib/auth/service";
import { clearDevMail, readDraftCookie, writeDevMail, writeSession } from "@/lib/auth/cookies";
import {
  authDeliveryMode,
  authIsClosed,
  authUsesInbox,
  authUsesMailbox,
  CLOSED_SIGNUP_MESSAGE,
} from "@/lib/auth/release";
import { ensurePhase0TokenMigration } from "@/lib/auth/token-migration";
import { sendAuthMail } from "@/lib/mail/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  ensurePhase0TokenMigration();
  if (authIsClosed()) {
    const response = NextResponse.json({ error: CLOSED_SIGNUP_MESSAGE }, { status: 503 });
    clearDevMail(response, request);
    return response;
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    terms?: boolean;
  } | null;
  const result = registerAccount({
    name: body?.name ?? "",
    email: body?.email ?? "",
    password: body?.password ?? "",
    terms: Boolean(body?.terms),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const draft = await readDraftCookie();
  if (draft) saveDraft(result.account.id, draft);

  const response = NextResponse.json({
    next: "/auth/verifieer",
    delivery: authDeliveryMode(),
  });
  writeSession(response, request, result.session);
  clearDevMail(response, request);

  if (authUsesInbox()) {
    const mailed = await sendAuthMail({ to: result.account.email, purpose: "verify", token: result.token });
    if (!mailed.ok) {
      return NextResponse.json(
        { error: mailed.error ?? "Verificatiemail kon niet worden verstuurd." },
        { status: 502 },
      );
    }
  } else if (authUsesMailbox()) {
    writeDevMail(response, request, `/auth/verifieer/bevestig?token=${encodeURIComponent(result.token)}`);
  }

  return response;
}
