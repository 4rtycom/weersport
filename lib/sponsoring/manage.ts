import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { normalizeEmail, validateEmail } from "@/lib/auth/service";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";
import { buildLines, uniqueKnownSports } from "@/lib/sponsoring/quote";
import { resolveMonthlyRate } from "@/lib/sponsoring/rate";
import { nextPeriodStart } from "@/lib/sponsoring/months";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueManageToken(sponsorId: string, now = new Date()) {
  ensureCommercialSchema();
  const token = randomBytes(24).toString("base64url");
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db()
    .prepare("INSERT INTO sponsor_manage_tokens (token_hash, sponsor_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), sponsorId, expires);
  return { token, expiresAt: expires };
}

export function sponsorIdForToken(token: string, now = new Date()) {
  ensureCommercialSchema();
  if (!token || token.length < 20) return null;
  const row = db().prepare("SELECT sponsor_id, expires_at FROM sponsor_manage_tokens WHERE token_hash = ?").get(hashToken(token)) as
    | { sponsor_id: string; expires_at: string }
    | undefined;
  if (!row || Date.parse(row.expires_at) <= now.getTime()) return null;
  return row.sponsor_id;
}

export function manageView(sponsorId: string) {
  ensureCommercialSchema();
  const profile = db().prepare("SELECT id, public_name, destination_url, moderation_status, moderation_reason FROM sponsor_profiles WHERE id = ?").get(sponsorId) as
    | {
        id: string;
        public_name: string;
        destination_url: string;
        moderation_status: string;
        moderation_reason: string | null;
      }
    | undefined;
  if (!profile) return null;
  const billing = db()
    .prepare("SELECT invoice_email, city, country FROM sponsor_billing_profiles WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(sponsorId) as { invoice_email: string; city: string; country: string } | undefined;
  const contract = db()
    .prepare("SELECT * FROM sponsor_contracts WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(sponsorId) as
    | {
        id: string;
        status: string;
        paid_until: string | null;
        anchor_day: number;
        rate_cents: number;
        cancel_effective_at: string | null;
        pending_sport_ids: string | null;
      }
    | undefined;
  const sports = contract
    ? (db()
        .prepare(
          `SELECT sport_id FROM sponsor_contract_sports WHERE contract_id = ? ORDER BY period_start DESC, sport_id LIMIT 24`,
        )
        .all(contract.id) as Array<{ sport_id: string }>)
    : [];
  const invoices = contract
    ? (db()
        .prepare(
          "SELECT id, period_start, status, email_status, gross_cents, invoice_number FROM sponsor_invoice_periods WHERE contract_id = ? ORDER BY period_start",
        )
        .all(contract.id) as Array<{
        id: string;
        period_start: string;
        status: string;
        gross_cents: number;
        invoice_number: string | null;
      }>)
    : [];
  return { profile, billing: billing ?? null, contract: contract ?? null, sports: [...new Set(sports.map((sport) => sport.sport_id))], invoices };
}

export function changeInvoiceEmail(sponsorId: string, email: unknown) {
  const normalized = typeof email === "string" ? normalizeEmail(email) : "";
  if (!validateEmail(normalized)) return { ok: false as const, error: "Vul een geldig factuur-e-mailadres in." };
  const current = db()
    .prepare("SELECT * FROM sponsor_billing_profiles WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(sponsorId) as
    | {
        legal_name: string;
        street: string;
        postal_code: string;
        city: string;
        country: string;
        vat_id: string | null;
      }
    | undefined;
  if (!current) return { ok: false as const, error: "Geen factuurprofiel." };
  db()
    .prepare(
      `INSERT INTO sponsor_billing_profiles (
        id, sponsor_id, legal_name, street, postal_code, city, country, vat_id, invoice_email, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      sponsorId,
      current.legal_name,
      current.street,
      current.postal_code,
      current.city,
      current.country,
      current.vat_id,
      normalized,
      new Date().toISOString(),
    );
  return { ok: true as const, invoiceEmail: normalized };
}

export function scheduleCancellation(sponsorId: string, now = new Date()) {
  const contract = db()
    .prepare("SELECT id, status, paid_until FROM sponsor_contracts WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(sponsorId) as { id: string; status: string; paid_until: string | null } | undefined;
  if (!contract?.paid_until || contract.status === "ended" || contract.status === "draft") {
    return { ok: false as const, error: "Er is geen lopend contract om op te zeggen." };
  }
  db()
    .prepare(
      `UPDATE sponsor_contracts SET status = 'cancel_scheduled', cancel_effective_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(contract.paid_until, now.toISOString(), contract.id);
  return { ok: true as const, cancelEffectiveAt: contract.paid_until };
}

export function previewNextSelection(sponsorId: string, sportIds: unknown) {
  const selected = uniqueKnownSports(sportIds);
  if (!selected.ok) return { ok: false as const, error: selected.error };
  const contract = db()
    .prepare("SELECT id, rate_cents, paid_until, anchor_day, rate_version FROM sponsor_contracts WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(sponsorId) as
    | { id: string; rate_cents: number; paid_until: string | null; anchor_day: number; rate_version: string }
    | undefined;
  if (!contract?.paid_until) return { ok: false as const, error: "Er is nog geen betaalde periode." };
  const rate = resolveMonthlyRate();
  const cents = rate.ok && rate.version === contract.rate_version ? rate.cents : contract.rate_cents;
  const lines = buildLines(selected.ids, cents);
  const nextStart = contract.paid_until;
  const nextEnd = nextPeriodStart(nextStart, contract.anchor_day);
  db()
    .prepare("UPDATE sponsor_contracts SET pending_sport_ids = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(selected.ids), new Date().toISOString(), contract.id);
  return {
    ok: true as const,
    appliesFrom: nextStart,
    appliesUntil: nextEnd,
    netCents: lines.reduce((sum, line) => sum + line.netCents, 0),
    vatCents: lines.reduce((sum, line) => sum + line.vatCents, 0),
    grossCents: lines.reduce((sum, line) => sum + line.grossCents, 0),
    sports: lines.map((line) => line.sportName),
  };
}
