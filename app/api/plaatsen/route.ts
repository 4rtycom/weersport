import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const places = await searchPlaces(query);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json(
      { places: [], error: "De Nederlandse plaatscontrole is nu niet bereikbaar." },
      { status: 503 },
    );
  }
}
