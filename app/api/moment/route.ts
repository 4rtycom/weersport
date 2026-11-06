import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession, saveDraft } from "@/lib/auth/service";
import { SESSION_COOKIE, writeDraft } from "@/lib/auth/cookies";
import { peekMeteredAnalysis, runMeteredAnalysis } from "@/lib/billing/analysis";
import { prepareSearch } from "@/lib/search";
import { parseDraft } from "@/lib/draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResult(result: Awaited<ReturnType<typeof runMeteredAnalysis>>) {
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        booked: false,
        consumed: 0,
        analysis: false,
        quotaExhausted: result.quotaExhausted,
        readOnly: result.readOnly,
        fingerprint: result.fingerprint,
        entitlement: result.entitlement,
        snapshot: result.snapshot,
        next: result.next,
      },
      { status: result.status },
    );
  }
  return NextResponse.json({
    booked: result.booked,
    consumed: result.consumed,
    cacheHit: result.cacheHit,
    analysis: result.booked,
    quotaExhausted: result.quotaExhausted,
    readOnly: result.readOnly,
    fingerprint: result.fingerprint,
    snapshot: result.snapshot,
    entitlement: result.entitlement,
  });
}

/** Explicit analysis start — only path that may book quota. */
export async function POST(request: Request) {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) {
    return NextResponse.json({ error: "Log in om weer- en veiligheidsdata te laden.", booked: false, consumed: 0 }, { status: 401 });
  }
  if (!account.verified) {
    return NextResponse.json(
      { error: "Verifieer eerst je e-mailadres.", booked: false, consumed: 0, next: "/auth/verifieer" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const prepared = body
    ? await prepareSearch(body)
    : account.draft
      ? { ok: true as const, draft: account.draft }
      : { ok: false as const, status: 400, error: "Geen bewaarde zoekopdracht." };

  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error, booked: false, consumed: 0 }, { status: prepared.status });
  }

  const idempotencyKey =
    request.headers.get("idempotency-key") ||
    (typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null);

  const result = await runMeteredAnalysis({
    userId: account.id,
    draft: prepared.draft,
    idempotencyKey,
  });

  if (!result.ok) {
    return jsonResult(result);
  }

  saveDraft(account.id, prepared.draft);
  const response = jsonResult(result);
  writeDraft(response, request, prepared.draft);
  return response;
}

/** Read-only peek — never books quota. Refresh/revisit safe. */
export async function GET() {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return NextResponse.json({ error: "Niet ingelogd.", booked: false, consumed: 0 }, { status: 401 });
  const draft = account.draft;
  if (!draft || !parseDraft(draft)) {
    return NextResponse.json({ error: "Geen bewaarde zoekopdracht.", booked: false, consumed: 0 }, { status: 400 });
  }
  const result = peekMeteredAnalysis({ userId: account.id, draft });
  return jsonResult(result);
}
