import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/cookies";
import { createSponsorCheckout } from "@/lib/sponsoring/checkout";
import { publicRequestOrigin } from "@/lib/sponsoring/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, errors: { form: "De aanvraag is onleesbaar." } }, { status: 400 });
  const account = await readSession().catch(() => null);
  const origin = publicRequestOrigin(request);
  const result = await createSponsorCheckout({
    quoteId: body.quoteId,
    attemptId: body.attemptId,
    publicName: body.publicName,
    destinationUrl: body.destinationUrl,
    logoId: body.logoId,
    billing: (body.billing ?? {}) as Record<string, unknown>,
    consent: body.consent,
    clientGrossCents: body.clientGrossCents,
    origin,
    ownerUserId: account?.id ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        errors: result.errors,
        serverGrossCents: "serverGrossCents" in result ? result.serverGrossCents : undefined,
        attemptId: "attemptId" in result ? result.attemptId : undefined,
      },
      { status: result.status },
    );
  }
  return NextResponse.json({
    ok: true,
    reused: result.reused,
    attemptId: result.checkout.attemptId,
    checkout: {
      checkoutId: result.checkout.checkoutId,
      status: result.checkout.status,
      checkoutUrl: result.checkout.checkoutUrl,
      mode: result.checkout.mode,
      amountCents: result.checkout.amountCents,
      currency: result.checkout.currency,
    },
  });
}
