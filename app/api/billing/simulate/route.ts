import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { isVercelProduction } from "@/lib/auth/release";
import {
  applyFailedCollection,
  applyRefund,
  applyRenewal,
  getCheckoutPublic,
  transitionEventId,
  verifyAndApplyPayment,
} from "@/lib/billing/mollie";
import { billingMode } from "@/lib/billing/mollie-mode";

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
  if (billingMode() !== "sandbox-local") {
    return NextResponse.json(
      { error: "Simulatie alleen beschikbaar in sandbox-local (geen MOLLIE_API_KEY)." },
      { status: 400 },
    );
  }
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    checkoutId?: string;
    status?: "paid" | "failed" | "canceled" | "pending" | "expired";
    action?: "pay" | "renew" | "refund" | "failed_collection";
  } | null;

  const action = body?.action ?? "pay";

  if (action === "renew") {
    const renewed = applyRenewal({ userId: account.id });
    if (!renewed.ok) return NextResponse.json({ error: renewed.error }, { status: renewed.status });
    return NextResponse.json({
      ok: true,
      action: "renew",
      entitlement: renewed.entitlement,
      periodEnd: renewed.periodEnd,
      duplicate: renewed.duplicate,
    });
  }

  if (action === "failed_collection") {
    const failed = applyFailedCollection({ userId: account.id });
    if (!failed.ok) return NextResponse.json({ error: failed.error }, { status: failed.status });
    return NextResponse.json({
      ok: true,
      action: "failed_collection",
      entitlement: failed.entitlement,
      duplicate: failed.duplicate,
    });
  }

  if (action === "refund") {
    const refunded = applyRefund({ userId: account.id, invoiceId: undefined });
    if (!refunded.ok) return NextResponse.json({ error: refunded.error }, { status: refunded.status });
    return NextResponse.json({
      ok: true,
      action: "refund",
      entitlement: refunded.entitlement,
      duplicate: refunded.duplicate,
      invoiceId: refunded.invoiceId,
    });
  }

  if (!body?.checkoutId) {
    return NextResponse.json({ error: "checkoutId ontbreekt." }, { status: 400 });
  }

  const checkout = getCheckoutPublic(body.checkoutId, account.id);
  const paymentId = checkout?.mollie_payment_id ?? `checkout:${body.checkoutId}`;
  const status = body.status ?? "paid";

  const result = await verifyAndApplyPayment({
    checkoutId: body.checkoutId,
    expectedUserId: account.id,
    simulatedStatus: status,
    providerEventId: transitionEventId(paymentId, status),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    action: "pay",
    state: result.state,
    entitlement: result.entitlement,
    duplicate: result.duplicate,
    ignored: result.ignored,
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
