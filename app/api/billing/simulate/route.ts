import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { isVercelProduction } from "@/lib/auth/release";
import { mollieMode, verifyAndApplyPayment } from "@/lib/billing/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local sandbox confirmation — still goes through verifyAndApplyPayment, never trust redirect alone. */
export async function POST(request: Request) {
  if (isVercelProduction()) {
    return NextResponse.json(
      { error: "Betalingssimulatie is uitgeschakeld op productie." },
      { status: 403 },
    );
  }
  if (mollieMode() !== "sandbox-local") {
    return NextResponse.json({ error: "Simulatie alleen beschikbaar zonder MOLLIE_API_KEY." }, { status: 400 });
  }
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    checkoutId?: string;
    status?: "paid" | "failed" | "canceled" | "pending";
  } | null;
  if (!body?.checkoutId) {
    return NextResponse.json({ error: "checkoutId ontbreekt." }, { status: 400 });
  }

  const result = await verifyAndApplyPayment({
    checkoutId: body.checkoutId,
    expectedUserId: account.id,
    simulatedStatus: body.status ?? "paid",
    providerEventId: `simulate:${body.checkoutId}:${body.status ?? "paid"}`,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    state: result.state,
    entitlement: result.entitlement,
    duplicate: result.duplicate,
    next:
      result.state === "payment_paid"
        ? "/checkout/succes"
        : result.state === "payment_failed"
          ? "/checkout/mislukt"
          : result.state === "cancelled"
            ? "/checkout/geannuleerd"
            : "/checkout/pending",
  });
}
