import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/service";
import { clearDevMail, writeDevMail } from "@/lib/auth/cookies";
import { authIsClosed } from "@/lib/auth/release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Always returns the same confirmation path for known and unknown emails.
 * In closed mode no token is issued to the browser (cookie/body/redirect).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const response = NextResponse.json({ next: "/auth/herstel/verstuurd" });

  if (authIsClosed()) {
    clearDevMail(response, request);
    // Do not call requestPasswordReset — avoids creating usable tokens without inbox delivery.
    return response;
  }

  const issued = requestPasswordReset(body?.email ?? "");
  if (issued) writeDevMail(response, request, `/auth/herstel/nieuw?token=${encodeURIComponent(issued.token)}`);
  else clearDevMail(response, request);
  return response;
}
