import { NextResponse } from "next/server";
import { requireVerifiedAccount } from "@/lib/alerts/http";
import { deletePushSubscription, listAlerts, savePushSubscription, updateAlert } from "@/lib/alerts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length < 1000;
  } catch {
    return false;
  }
}

/** Saves this device's push subscription and turns push on for the user's alerts. */
export async function POST(request: Request) {
  const auth = await requireVerifiedAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const authKey = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!isPushEndpoint(endpoint) || p256dh.length < 80 || authKey.length < 16) {
    return NextResponse.json({ error: "Deze browser gaf geen geldig pushadres." }, { status: 400 });
  }
  savePushSubscription(auth.account.id, { endpoint, p256dh, auth: authKey });
  for (const alert of listAlerts(auth.account.id)) updateAlert(auth.account.id, alert.id, { push: true });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireVerifiedAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint === "string") deletePushSubscription(auth.account.id, body.endpoint);
  return NextResponse.json({ ok: true });
}
