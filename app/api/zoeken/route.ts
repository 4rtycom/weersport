import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession, saveDraft } from "@/lib/auth/service";
import { SESSION_COOKIE, writeDraft } from "@/lib/auth/cookies";
import { prepareSearch } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const prepared = await prepareSearch(body ?? {});
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error, booked: false }, { status: prepared.status });
  }

  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (account) saveDraft(account.id, prepared.draft);
  const next = !account ? "/auth" : account.verified ? "/auth/hervat" : "/auth/verifieer";
  const response = NextResponse.json({ next, booked: false, draft: prepared.draft });
  writeDraft(response, request, prepared.draft);
  return response;
}
