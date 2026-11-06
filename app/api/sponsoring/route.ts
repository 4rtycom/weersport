import { NextResponse } from "next/server";
import { saveSponsorship } from "@/lib/sponsoring/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    organisation?: unknown;
    email?: unknown;
    message?: unknown;
    wsHp?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ ok: false, errors: { form: "De aanvraag is onleesbaar." } }, { status: 400 });
  }
  const result = saveSponsorship(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    id: result.request.id,
    mailed: result.mailed,
    inboxConfigured: Boolean(result.request.inbox),
  });
}
