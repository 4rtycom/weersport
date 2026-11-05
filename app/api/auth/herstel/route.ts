import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/service";
import { clearDevMail, writeDevMail } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const issued = requestPasswordReset(body?.email ?? "");
  const response = NextResponse.json({ next: "/auth/herstel/verstuurd" });
  if (issued) writeDevMail(response, request, `/auth/herstel/nieuw?token=${encodeURIComponent(issued.token)}`);
  else clearDevMail(response, request);
  return response;
}
