import { NextResponse } from "next/server";
import { createQuote } from "@/lib/sponsoring/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { sportIds?: unknown; country?: unknown } | null;
  const result = createQuote({ sportIds: body?.sportIds, country: body?.country });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, field: result.field }, { status: result.status });
  const { quote } = result;
  return NextResponse.json({
    ok: true,
    quote: {
      id: quote.id,
      sportIds: quote.sportIds,
      country: quote.country,
      rateVersion: quote.rateVersion,
      rateMode: quote.rateMode,
      netCents: quote.netCents,
      vatCents: quote.vatCents,
      grossCents: quote.grossCents,
      lines: quote.lines.map((line) => ({ sportId: line.sportId, sportName: line.sportName, netCents: line.netCents, vatCents: line.vatCents, grossCents: line.grossCents })),
      expiresAt: quote.expiresAt,
      label: quote.label,
    },
  });
}
