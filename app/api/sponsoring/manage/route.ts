import { NextResponse } from "next/server";
import { changeInvoiceEmail, manageView, previewNextSelection, scheduleCancellation, sponsorIdForToken } from "@/lib/sponsoring/manage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const sponsorId = sponsorIdForToken(token);
  if (!sponsorId) return NextResponse.json({ error: "Beheertoegang is ongeldig of verlopen." }, { status: 403 });
  const view = manageView(sponsorId);
  if (!view) return NextResponse.json({ error: "Sponsor niet gevonden." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    profile: view.profile,
    invoiceEmail: view.billing?.invoice_email ?? null,
    contract: view.contract
      ? { status: view.contract.status, paidUntil: view.contract.paid_until, cancelEffectiveAt: view.contract.cancel_effective_at }
      : null,
    sports: view.sports,
    invoices: view.invoices,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; action?: string; email?: string; sportIds?: unknown } | null;
  const sponsorId = body?.token ? sponsorIdForToken(body.token) : null;
  if (!sponsorId) return NextResponse.json({ error: "Beheertoegang is ongeldig of verlopen." }, { status: 403 });
  if (body?.action === "email") {
    const result = changeInvoiceEmail(sponsorId, body.email);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  if (body?.action === "cancel") {
    const result = scheduleCancellation(sponsorId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  if (body?.action === "selection") {
    const result = previewNextSelection(sponsorId, body.sportIds);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
}
