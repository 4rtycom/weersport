"use client";

/** Browser side of push: register the service worker and subscribe this device. */
export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone and iPad only allow push for a site added to the home screen. */
export function needsHomeScreen() {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function keyToBytes(base64url: string) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(vapidPublicKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pushSupported()) return { ok: false, error: "Deze browser ondersteunt geen pushberichten." };
  if (needsHomeScreen()) {
    return { ok: false, error: "Op iPhone en iPad werkt push alleen als je WeerSport eerst aan je beginscherm toevoegt (Deel → Zet op beginscherm)." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Je hebt meldingen niet toegestaan. Pas dit aan in de instellingen van je browser." };
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidPublicKey) }));
    const response = await fetch("/api/alerts/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Push kon niet worden opgeslagen." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Push kon niet worden aangezet. Probeer het opnieuw." };
  }
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await fetch("/api/alerts/push", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}
