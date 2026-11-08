import { NextResponse } from "next/server";
import { collectDue } from "@/lib/sponsoring/collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.WEERSPORT_JOB_SECRET?.trim() ?? "";
  if (!secret || request.headers.get("x-weersport-job") !== secret) {
    return NextResponse.json({ error: "Niet beschikbaar." }, { status: 404 });
  }
  const results = await collectDue();
  return NextResponse.json({ ok: true, results });
}
