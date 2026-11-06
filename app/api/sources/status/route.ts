import { NextResponse } from "next/server";
import { probeProviderFreshness } from "@/lib/data/freshness";
import { assertCompleteMatrix, SPORT_DEPENDENCY_MATRIX } from "@/lib/data/sport-dependencies";
import { SOURCE_RIGHTS } from "@/lib/data/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Phase 2 provider freshness + source contracts.
 * Independent of database health (does not open SQLite/Postgres).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const place = url.searchParams.get("place")?.trim() || "Amsterdam";
  assertCompleteMatrix();
  const freshness = await probeProviderFreshness(place);
  return NextResponse.json({
    service: "weersport",
    phase: "2",
    independentOfDatabase: true,
    place,
    generatedAt: freshness.generatedAt,
    providers: freshness.providers,
    rights: SOURCE_RIGHTS,
    sportDependencies: {
      rows: SPORT_DEPENDENCY_MATRIX.length,
      matrix: SPORT_DEPENDENCY_MATRIX,
    },
  });
}
