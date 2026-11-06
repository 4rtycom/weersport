import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession, saveDraft } from "@/lib/auth/service";
import { SESSION_COOKIE, writeDraft } from "@/lib/auth/cookies";
import { parseDraft } from "@/lib/draft";
import {
  deleteSavedSearch,
  draftFromSearch,
  listSavedSearches,
  saveSearch,
  touchSavedSearch,
} from "@/lib/moments/store";
import { PHASE05_BOOKING } from "@/lib/moments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAccount() {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return { error: NextResponse.json({ error: "Log in om zoekfilters te bewaren.", ...PHASE05_BOOKING }, { status: 401 }) };
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
  return NextResponse.json({ searches: listSavedSearches(auth.account.id), ...PHASE05_BOOKING });
}

export async function POST(request: Request) {
  const auth = await requireAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const draft = parseDraft(body);
  if (!draft) {
    return NextResponse.json({ error: "Ongeldige zoekfilters.", ...PHASE05_BOOKING }, { status: 400 });
  }
  const search = saveSearch(auth.account.id, draft);
  return NextResponse.json({ search, ...PHASE05_BOOKING });
}

export async function PUT(request: Request) {
  const auth = await requireAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Zoekopdracht ontbreekt.", ...PHASE05_BOOKING }, { status: 400 });
  }
  const search = touchSavedSearch(auth.account.id, body.id);
  if (!search) {
    return NextResponse.json({ error: "Zoekopdracht niet gevonden.", ...PHASE05_BOOKING }, { status: 404 });
  }
  const draft = draftFromSearch(search);
  saveDraft(auth.account.id, draft);
  const response = NextResponse.json({
    search,
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
  if (!body?.id || !deleteSavedSearch(auth.account.id, body.id)) {
    return NextResponse.json({ error: "Zoekopdracht niet gevonden.", ...PHASE05_BOOKING }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...PHASE05_BOOKING });
}
