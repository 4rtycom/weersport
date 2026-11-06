import { NextResponse } from "next/server";
import { isVercelProduction } from "@/lib/auth/release";
import { latestLoggedMail, mailDriver } from "@/lib/mail/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staging/local Gate A helper — returns the latest logged auth mail for an address.
 * Disabled on production and when the mail driver is not "log".
 */
export async function GET(request: Request) {
  if (isVercelProduction() || mailDriver() !== "log") {
    return NextResponse.json({ error: "Mailbox-inspectie is niet beschikbaar." }, { status: 404 });
  }
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const purpose = url.searchParams.get("purpose") as "verify" | "reset" | null;
  if (!email) return NextResponse.json({ error: "email ontbreekt" }, { status: 400 });
  const row = await latestLoggedMail(email, purpose ?? undefined);
  if (!row) return NextResponse.json({ mail: null });
  const meta = row.meta_json ? (JSON.parse(row.meta_json) as { link?: string }) : {};
  return NextResponse.json({
    mail: {
      id: row.id,
      to: row.to_email,
      subject: row.subject,
      purpose: row.purpose,
      createdAt: row.created_at,
      link: meta.link ?? null,
      bodyText: row.body_text,
    },
  });
}
