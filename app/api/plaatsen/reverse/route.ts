import { NextResponse } from "next/server";
import { DATA_FLAG, dataFlagEnabled } from "@/lib/data/flags";
import { reverseNlPoint } from "@/lib/data/geo/locations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!dataFlagEnabled(DATA_FLAG.pdokV2)) {
    return NextResponse.json({ error: "Niet beschikbaar." }, { status: 404 });
  }
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Ongeldige coördinaten." }, { status: 400 });
  }
  try {
    const place = await reverseNlPoint({ latitude, longitude });
    if (!place) return NextResponse.json({ error: "Geen Nederlandse locatie." }, { status: 404 });
    return NextResponse.json({ place });
  } catch {
    return NextResponse.json({ error: "Coördinaat ligt buiten Nederland of is verwisseld." }, { status: 400 });
  }
}
