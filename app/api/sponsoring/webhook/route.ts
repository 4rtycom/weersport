import { NextResponse } from "next/server";
import { verifySponsorPayment } from "@/lib/sponsoring/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let paymentId = "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    paymentId = body?.id ?? "";
  } else {
    const form = await request.formData().catch(() => null);
    paymentId = String(form?.get("id") ?? "");
  }
  if (!paymentId) return NextResponse.json({ error: "Payment id ontbreekt." }, { status: 400 });
  const result = await verifySponsorPayment({ paymentId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, scope: "sponsoring", status: result.checkout.status });
}
