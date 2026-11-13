import { NextResponse } from "next/server";
import { requireVerifiedAccount } from "@/lib/alerts/http";
import { createAlert, deleteAlert, listAlerts, updateAlert } from "@/lib/alerts/store";
import { lookupPlaceCoords } from "@/lib/data/adapters/pdok-geo";
import { landSports } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireVerifiedAccount();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ alerts: listAlerts(auth.account.id) });
}

export async function POST(request: Request) {
  const auth = await requireVerifiedAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { sportId?: unknown; placeId?: unknown; placeLabel?: unknown } | null;
  const sportId = typeof body?.sportId === "string" ? body.sportId : "";
  const placeId = typeof body?.placeId === "string" ? body.placeId : "";
  if (!landSports.some((sport) => sport.id === sportId)) {
    return NextResponse.json(
      { error: "Meldingen werken voor sporten die een score krijgen op het weer alleen, dus niet voor water- en ijssporten." },
      { status: 400 },
    );
  }
  if (!placeId) return NextResponse.json({ error: "Kies eerst een plaats." }, { status: 400 });
  let coords;
  try {
    coords = await lookupPlaceCoords(placeId);
  } catch {
    return NextResponse.json({ error: "Deze plaats kon niet worden gecontroleerd. Probeer het later opnieuw." }, { status: 502 });
  }
  const result = createAlert({
    userId: auth.account.id,
    sportId,
    placeId,
    placeLabel: typeof body?.placeLabel === "string" && body.placeLabel.trim() ? body.placeLabel.trim() : coords.label,
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ alert: result.alert });
}

export async function PATCH(request: Request) {
  const auth = await requireVerifiedAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const changed = updateAlert(auth.account.id, id, {
    minScore: typeof body?.minScore === "number" ? body.minScore : undefined,
    days: body?.days === "weekend" || body?.days === "any" ? body.days : undefined,
    email: typeof body?.email === "boolean" ? body.email : undefined,
    push: typeof body?.push === "boolean" ? body.push : undefined,
    active: typeof body?.active === "boolean" ? body.active : undefined,
  });
  if (!changed) return NextResponse.json({ error: "Melding niet gevonden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireVerifiedAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const deleted = deleteAlert(auth.account.id, typeof body?.id === "string" ? body.id : "");
  if (!deleted) return NextResponse.json({ error: "Melding niet gevonden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
