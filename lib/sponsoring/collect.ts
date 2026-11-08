import { db } from "@/lib/auth/db";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";
import { createPeriodInvoice, recoverPendingInvoices } from "@/lib/sponsoring/checkout";
import { sponsorFlags } from "@/lib/sponsoring/flags";
import { amsterdamToday, nextPeriodStart, periodContains } from "@/lib/sponsoring/months";
import { readSalesInvoice } from "@/lib/sponsoring/provider";

type ContractRow = {
  id: string;
  sponsor_id: string;
  status: string;
  anchor_day: number;
  contract_date: string;
  paid_until: string | null;
  cancel_effective_at: string | null;
  pending_sport_ids: string | null;
  rate_cents: number;
};

type CheckoutRow = {
  mollie_customer_id: string | null;
  mollie_mandate_id: string | null;
  mollie_payment_id: string | null;
};

/**
 * One owner of follow-up collection: this worker creates a Mollie sales invoice.
 * It never creates a Mollie subscription for the same contract.
 */
export async function collectDue(now = new Date()) {
  ensureCommercialSchema();
  await recoverPendingInvoices(now);
  const today = amsterdamToday(now);
  const contracts = db()
    .prepare(`SELECT * FROM sponsor_contracts WHERE status IN ('active', 'cancel_scheduled')`)
    .all() as ContractRow[];
  const results: Array<{ contractId: string; action: string }> = [];
  for (const contract of contracts) {
    if (!contract.paid_until) continue;
    if (contract.cancel_effective_at && contract.cancel_effective_at <= contract.paid_until) {
      if (today >= contract.cancel_effective_at) {
        db()
          .prepare("UPDATE sponsor_contracts SET status = 'ended', updated_at = ? WHERE id = ?")
          .run(now.toISOString(), contract.id);
        results.push({ contractId: contract.id, action: "ended" });
      }
      continue;
    }
    if (today < contract.paid_until) continue;
    if (!sponsorFlags().collect) {
      results.push({ contractId: contract.id, action: "collect_disabled" });
      continue;
    }
    const periodStart = contract.paid_until;
    const periodEnd = nextPeriodStart(periodStart, contract.anchor_day);
    applyPendingSports(contract, periodStart);
    const checkout = db()
      .prepare(
        `SELECT mollie_customer_id, mollie_mandate_id, mollie_payment_id
         FROM sponsor_checkouts WHERE contract_id = ? AND status = 'paid' ORDER BY created_at LIMIT 1`,
      )
      .get(contract.id) as CheckoutRow | undefined;
    if (!checkout?.mollie_customer_id || !checkout.mollie_mandate_id) {
      results.push({ contractId: contract.id, action: "mandate_missing" });
      continue;
    }
    await createPeriodInvoice({
      contractId: contract.id,
      periodStart,
      periodEnd,
      kind: "collection",
      customerId: checkout.mollie_customer_id,
      mandateId: checkout.mollie_mandate_id,
      now,
    });
    results.push({ contractId: contract.id, action: "collection_started" });
  }
  await reconcileOpenInvoices();
  return results;
}

function applyPendingSports(contract: ContractRow, periodStart: string) {
  const database = db();
  const existing = database
    .prepare("SELECT COUNT(*) AS n FROM sponsor_contract_sports WHERE contract_id = ? AND period_start = ?")
    .get(contract.id, periodStart) as { n: number };
  if (existing.n > 0) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    const again = database
      .prepare("SELECT COUNT(*) AS n FROM sponsor_contract_sports WHERE contract_id = ? AND period_start = ?")
      .get(contract.id, periodStart) as { n: number };
    if (again.n > 0) {
      database.exec("COMMIT");
      return;
    }
    const fresh = database.prepare("SELECT pending_sport_ids FROM sponsor_contracts WHERE id = ?").get(contract.id) as {
      pending_sport_ids: string | null;
    };
    const pending = fresh.pending_sport_ids;
    if (!pending) {
      const latestStart = database
        .prepare(
          `SELECT period_start FROM sponsor_contract_sports WHERE contract_id = ? AND period_start < ? ORDER BY period_start DESC LIMIT 1`,
        )
        .get(contract.id, periodStart) as { period_start: string } | undefined;
      const carry = latestStart
        ? (database
            .prepare("SELECT sport_id FROM sponsor_contract_sports WHERE contract_id = ? AND period_start = ?")
            .all(contract.id, latestStart.period_start) as Array<{ sport_id: string }>)
        : [];
      for (const sport of carry) {
        database
          .prepare(
            `INSERT INTO sponsor_contract_sports (contract_id, sport_id, period_start) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
          )
          .run(contract.id, sport.sport_id, periodStart);
      }
    } else {
      const nextIds = JSON.parse(pending) as string[];
      for (const sportId of nextIds) {
        database
          .prepare(
            `INSERT INTO sponsor_contract_sports (contract_id, sport_id, period_start) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
          )
          .run(contract.id, sportId, periodStart);
      }
      database
        .prepare("UPDATE sponsor_contracts SET pending_sport_ids = NULL, updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), contract.id);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function reconcileOpenInvoices() {
  const rows = db()
    .prepare(
      `SELECT id, provider_invoice_id, status FROM sponsor_invoice_periods
       WHERE provider_invoice_id IS NOT NULL AND status IN ('collection_pending', 'open', 'draft')`,
    )
    .all() as Array<{ id: string; provider_invoice_id: string; status: string }>;
  for (const row of rows) {
    const remote = await readSalesInvoice(row.provider_invoice_id);
    if (!remote) continue;
    if (remote.status === "paid") {
      db().prepare("UPDATE sponsor_invoice_periods SET status = 'paid', invoice_number = COALESCE(?, invoice_number) WHERE id = ?").run(
        remote.number,
        row.id,
      );
      extendCoverage(row.id);
    }
  }
}

export function recordCollectionFailure(invoiceId: string) {
  ensureCommercialSchema();
  const row = db().prepare("SELECT * FROM sponsor_invoice_periods WHERE id = ?").get(invoiceId) as
    | { id: string; status: string; provider_invoice_id: string | null }
    | undefined;
  if (!row) return { ok: false as const, error: "Factuur niet gevonden." };
  if (row.status === "paid") return { ok: false as const, error: "Een betaalde factuur blijft betaald tot een aparte credit." };
  db().prepare("UPDATE sponsor_invoice_periods SET status = 'open' WHERE id = ?").run(invoiceId);
  return { ok: true as const, invoiceId, status: "open" as const, recoveryUsesSameInvoice: true };
}

export function markInvoicePaid(invoiceId: string) {
  ensureCommercialSchema();
  const row = db().prepare("SELECT id, status FROM sponsor_invoice_periods WHERE id = ?").get(invoiceId) as
    | { id: string; status: string }
    | undefined;
  if (!row) return { ok: false as const, error: "Factuur niet gevonden." };
  if (row.status === "paid") return { ok: true as const, duplicate: true, invoiceId };
  db().prepare("UPDATE sponsor_invoice_periods SET status = 'paid' WHERE id = ?").run(invoiceId);
  extendCoverage(invoiceId);
  return { ok: true as const, duplicate: false, invoiceId };
}

function extendCoverage(invoiceId: string) {
  const invoice = db().prepare("SELECT contract_id, period_end FROM sponsor_invoice_periods WHERE id = ?").get(invoiceId) as
    | { contract_id: string; period_end: string }
    | undefined;
  if (!invoice) return;
  db()
    .prepare(
      `UPDATE sponsor_contracts
       SET paid_until = ?, updated_at = ?
       WHERE id = ? AND (paid_until IS NULL OR paid_until < ?)`,
    )
    .run(invoice.period_end, new Date().toISOString(), invoice.contract_id, invoice.period_end);
}

export function coverageActive(contractPaidUntil: string | null, day: string) {
  if (!contractPaidUntil) return false;
  return periodContains("0000-01-01", contractPaidUntil, day);
}
