import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { createProCheckout } from "@/lib/billing/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) {
    return NextResponse.json({ error: "Log in om Pro te starten." }, { status: 401 });
  }
  if (!account.verified) {
    return NextResponse.json({ error: "Verifieer eerst je e-mailadres.", next: "/auth/verifieer" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    consent?: boolean;
    idempotencyKey?: string;
  } | null;
  const origin = request.headers.get("x-forwarded-host")
    ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host")}`
    : new URL(request.url).origin;

  const result = await createProCheckout({
    userId: account.id,
    email: account.email,
    name: account.name,
    consent: Boolean(body?.consent),
    origin,
    idempotencyKey: body?.idempotencyKey,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ checkout: result.checkout });
}
