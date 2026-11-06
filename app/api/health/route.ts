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
    // Request-path identity still uses sync SQLite until the async cutover.
    db().prepare("SELECT 1 AS ok").get();
  } catch {
    database = "error";
  }
  let durableStore: "ok" | "error" | "skipped" = "skipped";
  if (storeMode() === "postgres") {
    durableStore = "ok";
    try {
      await query("SELECT 1 AS ok");
    } catch {
      durableStore = "error";
    }
  }
  const status = database === "ok" ? 200 : 503;
  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      service: "weersport",
      phase: "1",
      checks: {
        database,
        store: storeMode(),
        durable: isDurableStore(),
        durableStore,
        authDelivery: authDeliveryMode(),
        mailDriver: mailDriver(),
      },
      time: new Date().toISOString(),
      latencyMs: Date.now() - started,
    },
    { status },
  );
}
