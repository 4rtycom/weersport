import { NextResponse } from "next/server";
import { verifyAndApplyPayment } from "@/lib/billing/mollie";
import { db } from "@/lib/auth/db";
import { ensureBillingSchema } from "@/lib/billing/schema";
import { usesMollieApi } from "@/lib/billing/mollie-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mollie webhook: notification only. Always re-fetch/verify payment before mutating entitlements.
 * Durable idempotency is payment-id + verified status (not a random delivery UUID).
 */
export async function POST(request: Request) {
  ensureBillingSchema();
  const contentType = request.headers.get("content-type") ?? "";
  let paymentId = "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    paymentId = body?.id ?? "";
  } else {
    const form = await request.formData().catch(() => null);
    paymentId = String(form?.get("id") ?? "");
  }
  if (!paymentId) {
    return NextResponse.json({ error: "Payment id ontbreekt." }, { status: 400 });
  }

  const checkout = db()
    .prepare("SELECT id FROM billing_checkouts WHERE mollie_payment_id = ?")
    .get(paymentId) as { id: string } | undefined;
  if (!checkout) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!usesMollieApi()) {
    return NextResponse.json({ ok: true, ignored: true, reason: "mollie-api-disabled" });
  }

  const applied = await verifyAndApplyPayment({ checkoutId: checkout.id });
  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: applied.status });
  }
  return NextResponse.json({
    ok: true,
    state: applied.state,
    duplicate: applied.duplicate,
    ignored: applied.ignored,
  });
}
