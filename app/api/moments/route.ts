import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession, saveDraft } from "@/lib/auth/service";
import { SESSION_COOKIE, writeDraft } from "@/lib/auth/cookies";
import { parseDraft } from "@/lib/draft";
import {
  createPlannedMoment,
  deletePlannedMoment,
  draftFromMoment,
  getPlannedMoment,
  listPlannedMoments,
} from "@/lib/moments/store";
import { PHASE05_BOOKING } from "@/lib/moments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAccount() {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return { error: NextResponse.json({ error: "Log in om sportmomenten te bewaren.", ...PHASE05_BOOKING }, { status: 401 }) };
  if (!account.verified) {
    return {
      error: NextResponse.json(
        { error: "Verifieer eerst je e-mailadres.", next: "/auth/verifieer", ...PHASE05_BOOKING },
        { status: 403 },
      ),
    };
  }
  return { account };
}

export async function GET() {
  const auth = await requireAccount();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ moments: listPlannedMoments(auth.account.id), ...PHASE05_BOOKING });
}

export async function POST(request: Request) {
  const auth = await requireAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const draft = parseDraft(body);
  if (!draft) {
    return NextResponse.json({ error: "Ongeldige zoekgegevens voor een sportmoment.", ...PHASE05_BOOKING }, { status: 400 });
  }
  const plannedStart = typeof body?.plannedStart === "string" ? body.plannedStart : "";
  const plannedEnd = typeof body?.plannedEnd === "string" ? body.plannedEnd : "";
  if (!plannedStart || !plannedEnd || Number.isNaN(Date.parse(plannedStart)) || Number.isNaN(Date.parse(plannedEnd))) {
    return NextResponse.json({ error: "Geef een geldig gepland tijdvak op.", ...PHASE05_BOOKING }, { status: 400 });
  }
  const moment = createPlannedMoment(auth.account.id, {
    draft,
    windowLabel: typeof body?.windowLabel === "string" && body.windowLabel.trim() ? body.windowLabel.trim().slice(0, 80) : "Gepland tijdvak",
    plannedStart,
    plannedEnd,
    note: typeof body?.note === "string" ? body.note.slice(0, 240) : "",
    lastSnapshotAt: typeof body?.lastSnapshotAt === "string" ? body.lastSnapshotAt : null,
    lastScoreLabel: typeof body?.lastScoreLabel === "string" ? body.lastScoreLabel : null,
  });
  return NextResponse.json({ moment, ...PHASE05_BOOKING });
}

export async function PUT(request: Request) {
  const auth = await requireAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Sportmoment ontbreekt.", ...PHASE05_BOOKING }, { status: 400 });
  }
  const moment = getPlannedMoment(auth.account.id, body.id);
  if (!moment) {
    return NextResponse.json({ error: "Sportmoment niet gevonden.", ...PHASE05_BOOKING }, { status: 404 });
  }
  const draft = draftFromMoment(moment);
  saveDraft(auth.account.id, draft);
  const response = NextResponse.json({
    moment,
    draft,
    next: "/#planner",
    ...PHASE05_BOOKING,
  });
  writeDraft(response, request, draft);
  return response;
}

export async function DELETE(request: Request) {
  const auth = await requireAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id || !deletePlannedMoment(auth.account.id, body.id)) {
    return NextResponse.json({ error: "Sportmoment niet gevonden.", ...PHASE05_BOOKING }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...PHASE05_BOOKING });
}
