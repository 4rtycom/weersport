import { NextResponse } from "next/server";
import { ingestAirStations } from "@/lib/data/luchtmeetnet/measurements";
import { ingestKnmiSnapshot } from "@/lib/data/knmi/ingest";
import { ingestRwsCatalog } from "@/lib/data/rws/measurements";
import { isProviderId, syncAuthorized, syncRateAllows } from "@/lib/data/providers/sync-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.DATA_SYNC_SECRET?.trim()) {
    return NextResponse.json({ error: "DATA_SYNC_SECRET ontbreekt." }, { status: 503 });
  }
  if (!syncAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { provider?: unknown } | null;
  const provider = typeof body?.provider === "string" ? body.provider : "";
  if (!isProviderId(provider)) {
    return NextResponse.json({ error: "Onbekende provider." }, { status: 400 });
  }
  if (!syncRateAllows(provider)) {
    return NextResponse.json({ error: "Te veel syncverzoeken." }, { status: 429 });
  }
  if (provider === "pdok") {
    return NextResponse.json({ ok: true, skipped: true, reason: "PDOK wordt per locatie gecachet." });
  }
  const result =
    provider === "knmi" ? await ingestKnmiSnapshot() : provider === "rws" ? await ingestRwsCatalog() : await ingestAirStations();
  if (!result.ok && result.code === "FLAG_OFF") {
    return NextResponse.json({ ok: true, skipped: true, reason: "flag-off", provider });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
