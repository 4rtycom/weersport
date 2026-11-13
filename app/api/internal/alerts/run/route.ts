import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAlerts } from "@/lib/alerts/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Called once a day by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  const summary = await runAlerts();
  return NextResponse.json({ ok: true, ...summary });
}
