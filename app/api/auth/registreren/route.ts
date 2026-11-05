import { NextResponse } from "next/server";
import { registerAccount, saveDraft } from "@/lib/auth/service";
import { readDraftCookie, writeDevMail, writeSession } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const response = NextResponse.json({ next: "/auth/verifieer" });
  writeSession(response, request, result.session);
  writeDevMail(response, request, `/auth/verifieer/bevestig?token=${encodeURIComponent(result.token)}`);
  return response;
}
