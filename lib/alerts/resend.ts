/** Minimal Resend client over HTTPS; no SDK needed. */
export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.ALERT_FROM_EMAIL?.trim());
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ALERT_FROM_EMAIL?.trim();
  if (!key || !from) return { ok: false, error: "RESEND_API_KEY of ALERT_FROM_EMAIL ontbreekt" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.unsubscribeUrl
          ? { "List-Unsubscribe": `<${input.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          : undefined,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !body.id) return { ok: false, error: body.message ?? `HTTP ${response.status}` };
    return { ok: true, id: body.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Onbekende fout" };
  }
}
