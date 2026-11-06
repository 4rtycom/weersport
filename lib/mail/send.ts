import { randomUUID } from "node:crypto";
import { isDurableStore, legacySqlite, storeMode } from "@/lib/db/client";

export type MailPurpose = "verify" | "reset";

export type MailDriver = "none" | "log" | "resend";

function isVercelProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function mailDriver(): MailDriver {
  if (process.env.RESEND_API_KEY && process.env.WEERSPORT_MAIL_FROM) return "resend";
  if (process.env.WEERSPORT_MAIL_DRIVER === "log") {
    if (isVercelProduction()) return "none";
    return "log";
  }
  return "none";
}

export function mailConfigured() {
  return mailDriver() !== "none";
}

function appOrigin() {
  return (
    process.env.WEERSPORT_APP_ORIGIN?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3000")
  );
}

export function absoluteAuthUrl(path: string) {
  return `${appOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendAuthMail(input: {
  to: string;
  purpose: MailPurpose;
  token: string;
}) {
  const path =
    input.purpose === "verify"
      ? `/auth/verifieer/bevestig?token=${encodeURIComponent(input.token)}`
      : `/auth/herstel/nieuw?token=${encodeURIComponent(input.token)}`;
  const link = absoluteAuthUrl(path);
  const subject =
    input.purpose === "verify" ? "Bevestig je WeerSport-account" : "Herstel je WeerSport-wachtwoord";
  const bodyText =
    input.purpose === "verify"
      ? `Bevestig je e-mailadres via deze eenmalige link (24 uur geldig):\n\n${link}\n\nAls je geen account hebt aangemaakt, kun je deze mail negeren.`
      : `Stel een nieuw wachtwoord in via deze eenmalige link (30 minuten geldig):\n\n${link}\n\nAls je geen herstel hebt aangevraagd, kun je deze mail negeren.`;

  const driver = mailDriver();
  if (driver === "none") {
    return { ok: false as const, error: "Geen mailprovider geconfigureerd." };
  }

  if (driver === "log") {
    // Phase 1 Gate A: write to the sync SQLite runtime so mailbox inspection matches auth tokens.
    const meta = JSON.stringify({ link, store: storeMode(), durable: isDurableStore() });
    const stamp = new Date().toISOString();
    const id = randomUUID();
    legacySqlite()
      .prepare(
        `INSERT INTO outbound_mail (id, to_email, subject, body_text, purpose, created_at, meta_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.to, subject, bodyText, input.purpose, stamp, meta);
    return { ok: true as const, driver, link };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.WEERSPORT_MAIL_FROM,
      to: [input.to],
      subject,
      text: bodyText,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false as const, error: `Resend faalde (${response.status}): ${detail.slice(0, 200)}` };
  }
  return { ok: true as const, driver, link: undefined };
}

/** Test/staging helper: latest logged mail for an address (never on production). */
export async function latestLoggedMail(toEmail: string, purpose?: MailPurpose) {
  if (isVercelProduction() || mailDriver() !== "log") return null;
  // Read from sync SQLite (where Gate A auth + log driver land in Phase 1).
  const database = legacySqlite();
  const row = purpose
    ? (database
        .prepare(
          `SELECT * FROM outbound_mail WHERE to_email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1`,
        )
        .get(toEmail, purpose) as MailRow | undefined)
    : (database
        .prepare(`SELECT * FROM outbound_mail WHERE to_email = ? ORDER BY created_at DESC LIMIT 1`)
        .get(toEmail) as MailRow | undefined);
  return row ?? null;
}

type MailRow = {
  id: string;
  to_email: string;
  subject: string;
  body_text: string;
  purpose: string;
  created_at: string;
  meta_json: string | null;
};
