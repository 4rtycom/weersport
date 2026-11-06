import { NextResponse } from "next/server";
import { db } from "@/lib/auth/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    db().prepare("SELECT 1 AS ok").get();
  } catch {
    database = "error";
  }
  const status = database === "ok" ? 200 : 503;
  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      service: "weersport",
      phase: "08",
      checks: {
        database,
      },
      time: new Date().toISOString(),
      latencyMs: Date.now() - started,
    },
    { status },
  );
}
