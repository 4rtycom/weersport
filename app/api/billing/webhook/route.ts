import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verifyAndApplyPayment } from "@/lib/billing/mollie";
import { verifySponsorPayment } from "@/lib/sponsoring/checkout";
import { db } from "@/lib/auth/db";
import { ensureBillingSchema } from "@/lib/billing/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mollie webhook: notification only. Always re-fetch/verify payment before mutating entitlements.
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
    const sponsor = await verifySponsorPayment({ paymentId });
    if (sponsor.ok) {
      return NextResponse.json({ ok: true, scope: "sponsoring", status: sponsor.checkout.status });
    }
    if (sponsor.status !== 404) {
      return NextResponse.json({ error: sponsor.error }, { status: sponsor.status });
    }
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await verifyAndApplyPayment({
    checkoutId: checkout.id,
    providerEventId: `mollie:${paymentId}:${randomUUID().slice(0, 8)}`,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, state: result.state, duplicate: result.duplicate });
}
