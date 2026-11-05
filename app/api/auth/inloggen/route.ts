import { NextResponse } from "next/server";
import { loginAccount, saveDraft } from "@/lib/auth/service";
import { readDraftCookie, writeSession } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const result = loginAccount(body?.email ?? "", body?.password ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  const draft = await readDraftCookie();
  if (draft) saveDraft(result.account.id, draft);
  const next = !result.account.verified ? "/auth/verifieer" : draft || result.account.draft ? "/auth/hervat" : "/";
  const response = NextResponse.json({ next });
  writeSession(response, request, result.session);
  return response;
}
