import { NextResponse } from "next/server";
import { deactivateByToken } from "@/lib/alerts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-click unsubscribe (RFC 8058) from the mail header, and the form on /meldingen/uit. No login needed. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = String(form?.get("token") ?? "");
  }
  const alert = deactivateByToken(token);
  const wantsHtml = (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsHtml) {
    return NextResponse.redirect(new URL(`/meldingen/uit?klaar=${alert ? "1" : "0"}`, url), 303);
  }
  if (!alert) return NextResponse.json({ error: "Deze afmeldlink is ongeldig." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
