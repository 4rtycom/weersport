import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const account = await readSession();
  return NextResponse.json(
    { signedIn: Boolean(account) },
    { headers: { "cache-control": "private, no-store" } },
  );
}
