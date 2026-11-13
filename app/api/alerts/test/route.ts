import { NextResponse } from "next/server";
import { requireVerifiedAccount } from "@/lib/alerts/http";
import { resendConfigured, sendEmail } from "@/lib/alerts/resend";
import { listPushSubscriptions, dropPushSubscription } from "@/lib/alerts/store";
import { sendPush, vapidConfigured } from "@/lib/alerts/webpush";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends a test mail and/or push to the signed-in user, so they can check that meldingen arrive. */
export async function POST(request: Request) {
  const auth = await requireVerifiedAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { channel?: unknown } | null;
  const channel = body?.channel === "push" ? "push" : "email";
  const url = `${SITE_URL}/account/meldingen`;

  if (channel === "email") {
    if (!resendConfigured()) return NextResponse.json({ error: "E-mail is nog niet ingesteld op de server." }, { status: 503 });
    const result = await sendEmail({
      to: auth.account.email,
      subject: "Testmelding van WeerSport",
      text: `Hoi ${auth.account.name},\n\nDeze testmail laat zien dat je WeerSport-meldingen aankomen.\n\nMeldingen beheren: ${url}`,
      html: `<p>Hoi ${auth.account.name.replace(/[<>&]/g, "")},</p><p>Deze testmail laat zien dat je WeerSport-meldingen aankomen.</p><p><a href="${url}">Meldingen beheren</a></p>`,
    });
    if (!result.ok) return NextResponse.json({ error: "De testmail kon niet worden verstuurd." }, { status: 502 });
    return NextResponse.json({ ok: true, message: `Testmail verstuurd naar ${auth.account.email}.` });
  }

  if (!vapidConfigured()) return NextResponse.json({ error: "Pushberichten zijn nog niet ingesteld op de server." }, { status: 503 });
  const subscriptions = listPushSubscriptions(auth.account.id);
  if (subscriptions.length === 0) return NextResponse.json({ error: "Zet eerst pushberichten aan op dit apparaat." }, { status: 400 });
  let delivered = 0;
  for (const subscription of subscriptions) {
    const result = await sendPush(subscription, {
      title: "Testmelding van WeerSport",
      body: "Zo ziet een melding over je beste sportmoment eruit.",
      url,
      tag: "test",
    });
    if (result.ok) delivered += 1;
    else if (result.gone) dropPushSubscription(subscription.endpoint);
  }
  if (delivered === 0) return NextResponse.json({ error: "Het pushbericht kwam niet aan. Zet push opnieuw aan." }, { status: 502 });
  return NextResponse.json({ ok: true, message: `Pushbericht verstuurd naar ${delivered} ${delivered === 1 ? "apparaat" : "apparaten"}.` });
}
