import { NextResponse } from "next/server";
import { formatPeriod, reachLabel, type AreaKind } from "@/lib/sponsoring/campaign";
import { saveSponsorship } from "@/lib/sponsoring/store";
import { sports } from "@/lib/sports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, errors: { form: "De aanvraag is onleesbaar." } }, { status: 400 });
  }
  const result = await saveSponsorship(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: result.status });
  }
  const saved = result.request;
  const response: {
    ok: true;
    id: string;
    mailed: false;
    inboxConfigured: boolean;
    receipt?: {
      id: string;
      sportId: string;
      sportName: string;
      placeId: string;
      placeLabel: string;
      province: string | null;
      areaKind: AreaKind;
      radiusKm: number | null;
      startDate: string;
      endDate: string;
      weeks: number;
      title: string;
      detail: string;
    };
  } = {
    ok: true,
    id: saved.id,
    mailed: result.mailed,
    inboxConfigured: Boolean(saved.inbox),
  };
  if (
    saved.requestType === "campaign_v1" &&
    saved.sportId &&
    saved.placeId &&
    saved.placeLabel &&
    saved.areaKind &&
    saved.desiredStart &&
    saved.endDate &&
    saved.durationWeeks
  ) {
    const sportName = sports.find((sport) => sport.id === saved.sportId)?.name ?? saved.sportId;
    response.receipt = {
      id: saved.id,
      sportId: saved.sportId,
      sportName,
      placeId: saved.placeId,
      placeLabel: saved.placeLabel,
      province: saved.province,
      areaKind: saved.areaKind,
      radiusKm: saved.radiusKm,
      startDate: saved.desiredStart,
      endDate: saved.endDate,
      weeks: saved.durationWeeks,
      title: `${sportName} in ${saved.placeLabel}`,
      detail: `${reachLabel(saved.areaKind, saved.radiusKm)} · ${formatPeriod(saved.desiredStart, saved.endDate)}`,
    };
  }
  return NextResponse.json(response);
}
