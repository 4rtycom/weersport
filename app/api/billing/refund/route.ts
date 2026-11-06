import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { applyRefund, mollieMode } from "@/lib/billing/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staging/sandbox refund — live Mollie refunds remain provider-dashboard only until keys are wired. */
export async function POST(request: Request) {
  if (mollieMode() !== "sandbox-local") {
    return NextResponse.json(
      {
        error:
          "Live Mollie-terugbetalingen lopen via Mollie Dashboard/support. Gebruik sandbox zonder MOLLIE_API_KEY voor lokale UAT.",
      },
      { status: 400 },
    );
  }
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { invoiceId?: string } | null;
  const result = applyRefund({ userId: account.id, invoiceId: body?.invoiceId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    invoiceId: result.invoiceId,
    entitlement: result.entitlement,
    duplicate: result.duplicate,
    message: result.message ?? "Terugbetaling verwerkt.",
  });
}
