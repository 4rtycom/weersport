import { NextResponse } from "next/server";
import { checkoutByReturnToken, verifySponsorPayment } from "@/lib/sponsoring/checkout";
import { markTestPayment } from "@/lib/sponsoring/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Test adapter only. The return visit itself never marks a payment paid. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; status?: string; mandate?: boolean } | null;
  const row = body?.token ? checkoutByReturnToken(body.token) : null;
  if (!row?.mollie_payment_id) return NextResponse.json({ error: "Betaling niet gevonden." }, { status: 404 });
  if (row.mode !== "test") return NextResponse.json({ error: "Alleen de testadapter kan een status zetten." }, { status: 403 });
  const status = body?.status;
  if (status !== "paid" && status !== "expired" && status !== "canceled" && status !== "failed") {
    return NextResponse.json({ error: "Onbekende teststatus." }, { status: 400 });
  }
  markTestPayment(row.mollie_payment_id, status, { mandate: body?.mandate });
  const result = await verifySponsorPayment({ checkoutId: row.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, status: result.checkout.status });
}
