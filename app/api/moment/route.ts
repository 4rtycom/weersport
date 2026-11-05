import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession, saveDraft } from "@/lib/auth/service";
import { SESSION_COOKIE, writeDraft } from "@/lib/auth/cookies";
import { buildForecastSnapshot } from "@/lib/data/snapshot";
import { prepareSearch } from "@/lib/search";
import { parseDraft } from "@/lib/draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) {
    return NextResponse.json({ error: "Log in om weer- en veiligheidsdata te laden.", booked: false }, { status: 401 });
  }
  if (!account.verified) {
    return NextResponse.json({ error: "Verifieer eerst je e-mailadres.", booked: false, next: "/auth/verifieer" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const prepared = body
    ? await prepareSearch(body)
    : account.draft
      ? { ok: true as const, draft: account.draft }
      : { ok: false as const, status: 400, error: "Geen bewaarde zoekopdracht." };

  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error, booked: false }, { status: prepared.status });
  }

  try {
    const snapshot = await buildForecastSnapshot(prepared.draft);
    saveDraft(account.id, prepared.draft);
    const response = NextResponse.json({
      booked: false,
      analysis: false,
      snapshot,
    });
    writeDraft(response, request, prepared.draft);
    return response;
  } catch {
    return NextResponse.json(
      {
        booked: false,
        analysis: false,
        error: "De bronketen is niet volledig bereikbaar. Er is geen score of veiligheidsclaim gemaakt.",
      },
      { status: 503 },
    );
  }
}

export async function GET() {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  const draft = account.draft;
  if (!draft || !parseDraft(draft)) {
    return NextResponse.json({ error: "Geen bewaarde zoekopdracht." }, { status: 400 });
  }
  const snapshot = await buildForecastSnapshot(draft);
  return NextResponse.json({ booked: false, analysis: false, snapshot });
}
