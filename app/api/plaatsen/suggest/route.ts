import { NextResponse } from "next/server";
import { DATA_FLAG, dataFlagEnabled } from "@/lib/data/flags";
import { suggestPlaces } from "@/lib/data/pdok/client";
import { toPlace } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!dataFlagEnabled(DATA_FLAG.pdokV2)) {
    return NextResponse.json({ error: "Niet beschikbaar." }, { status: 404 });
  }
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 2) return NextResponse.json({ places: [] });
  try {
    const places = (await suggestPlaces(query)).map(toPlace).filter((place) => place !== null);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [], error: "De Nederlandse plaatscontrole is nu niet bereikbaar." }, { status: 503 });
  }
}
