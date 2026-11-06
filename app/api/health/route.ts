import { NextResponse } from "next/server";
import { db, isDurableStore, storeMode } from "@/lib/auth/db";
import { query } from "@/lib/db/client";
import { authDeliveryMode } from "@/lib/auth/release";
import { mailDriver } from "@/lib/mail/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    // Runtime identity still uses sync SQLite in Phase 1; also probe Postgres when configured.
    db().prepare("SELECT 1 AS ok").get();
    if (storeMode() === "postgres") {
      await query("SELECT 1 AS ok");
    }
  } catch {
    database = "error";
  }
  const status = database === "ok" ? 200 : 503;
  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      service: "weersport",
      phase: "3",
      checks: {
        database,
        store: storeMode(),
        durable: isDurableStore(),
        authDelivery: authDeliveryMode(),
        mailDriver: mailDriver(),
        sourcesStatusPath: "/api/sources/status",
      },
      time: new Date().toISOString(),
      latencyMs: Date.now() - started,
    },
    { status },
  );
}
