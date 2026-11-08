import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { normalizeEmail, validateEmail } from "@/lib/auth/service";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";
import { sponsorFlags } from "@/lib/sponsoring/flags";
import { readLogo } from "@/lib/sponsoring/logo";
import { amsterdamDate, amsterdamToday, formatPeriodLabel, nextPeriodStart } from "@/lib/sponsoring/months";
import {
  createFirstIdealPayment,
  createSalesInvoice,
  createSponsorCustomer,
  readSponsorPayment,
  type ProviderEnvironment,
} from "@/lib/sponsoring/provider";
import { buildLines, quoteFingerprint, readQuote, type QuoteLine } from "@/lib/sponsoring/quote";
import { resolveMonthlyRate } from "@/lib/sponsoring/rate";
import { validateDestination, plainText } from "@/lib/sponsoring/validate";

export const CONSENT_VERSION = "sepa-incasso-v1";
export const CONSENT_TEXT =
  "Ik ga akkoord met maandelijkse SEPA-incasso na de eerste iDEAL-betaling, voor de gekozen sporten tegen het bevestigde maandtarief. Tekst sepa-incasso-v1.";

const POSTAL = /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/;
const VAT = /^NL[0-9]{9}B[0-9]{2}$/i;
const ATTEMPT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BillingInput = {
  legalName?: unknown;
  street?: unknown;
  postalCode?: unknown;
  city?: unknown;
  country?: unknown;
  vatId?: unknown;
  invoiceEmail?: unknown;
};

export type CheckoutInput = {
  quoteId?: unknown;
  attemptId?: unknown;
  publicName?: unknown;
  destinationUrl?: unknown;
  logoId?: unknown;
  billing?: BillingInput;
  consent?: unknown;
  clientGrossCents?: unknown;
  origin: string;
  ownerUserId?: string | null;
  now?: Date;
};

type CheckoutRow = {
  id: string;
  attempt_id: string;
  quote_id: string;
  sponsor_id: string;
  contract_id: string | null;
  request_hash: string;
  mollie_customer_id: string | null;
  mollie_payment_id: string | null;
  mollie_mandate_id: string | null;
  kind: string;
  amount_cents: number;
  currency: string;
  mode: string;
  status: string;
  checkout_url: string;
  return_token: string;
  environment: string;
};

function fieldError(field: string, error: string) {
  return { ok: false as const, status: 400, errors: { [field]: error } };
}

function sellerSnapshot() {
  const name = process.env.WEERSPORT_SELLER_LEGAL_NAME?.trim() || "";
  const vatId = process.env.WEERSPORT_SELLER_VAT_ID?.trim() || "";
  const address = process.env.WEERSPORT_SELLER_ADDRESS?.trim() || "";
  return {
    confirmed: Boolean(name && vatId && address),
    legalName: name || "Verkoper nog niet bevestigd",
    vatId: vatId || null,
    address: address || null,
  };
}

function requestHash(parts: unknown) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function validateBilling(input: BillingInput | undefined) {
  const billing = input ?? {};
  const legalName = plainText(typeof billing.legalName === "string" ? billing.legalName : "");
  const street = plainText(typeof billing.street === "string" ? billing.street : "");
  const postalCode = plainText(typeof billing.postalCode === "string" ? billing.postalCode : "").toUpperCase();
  const city = plainText(typeof billing.city === "string" ? billing.city : "");
  const country = typeof billing.country === "string" ? billing.country.trim().toUpperCase() : "";
  const vatRaw = plainText(typeof billing.vatId === "string" ? billing.vatId : "");
  const invoiceEmail = typeof billing.invoiceEmail === "string" ? normalizeEmail(billing.invoiceEmail) : "";
  if (legalName.length < 2 || legalName.length > 120) return fieldError("legalName", "Vul de juridische naam in.");
  if (street.length < 2 || street.length > 120) return fieldError("street", "Vul straat en huisnummer in.");
  if (!POSTAL.test(postalCode)) return fieldError("postalCode", "Vul een Nederlandse postcode in.");
  if (city.length < 2 || city.length > 80) return fieldError("city", "Vul de plaats in.");
  if (country !== "NL") return fieldError("country", "Facturatie buiten Nederland is nog niet beschikbaar.");
  if (vatRaw && !VAT.test(vatRaw.replace(/\s/g, ""))) return fieldError("vatId", "Het btw-nummer heeft niet de Nederlandse vorm.");
  if (!validateEmail(invoiceEmail)) return fieldError("invoiceEmail", "Vul een geldig factuur-e-mailadres in.");
  return {
    ok: true as const,
    value: {
      legalName,
      street,
      postalCode,
      city,
      country,
      vatId: vatRaw ? vatRaw.replace(/\s/g, "").toUpperCase() : null,
      invoiceEmail,
    },
  };
}

function publicCheckout(row: CheckoutRow) {
  return {
    checkoutId: row.id,
    attemptId: row.attempt_id,
    status: row.status,
    checkoutUrl: row.checkout_url,
    mode: row.mode as ProviderEnvironment,
    amountCents: row.amount_cents,
    currency: row.currency,
    returnToken: row.return_token,
  };
}

export async function createSponsorCheckout(input: CheckoutInput) {
  if (!sponsorFlags().signup) {
    return { ok: false as const, status: 403, errors: { form: "De sponsoraanmelding is nog niet open." } };
  }
  const quote = typeof input.quoteId === "string" ? readQuote(input.quoteId) : null;
  if (!quote) return fieldError("quote", "De offerte is ongeldig of verlopen.");
  const now = input.now ?? new Date();
  if (Date.parse(quote.expiresAt) <= now.getTime()) {
    return { ok: false as const, status: 409, errors: { quote: "De offerte is verlopen. Controleer het bedrag opnieuw." } };
  }
  const rate = resolveMonthlyRate();
  if (!rate.ok || rate.version !== quote.rateVersion || rate.cents !== quote.rateCents) {
    return {
      ok: false as const,
      status: 409,
      errors: { quote: "Het tarief is gewijzigd. Bevestig de nieuwe offerte." },
      quote,
    };
  }
  const lines = buildLines(quote.sportIds, rate.cents);
  const gross = lines.reduce((sum, line) => sum + line.grossCents, 0);
  if (gross !== quote.grossCents) {
    return {
      ok: false as const,
      status: 409,
      errors: { quote: "De selectie of de prijs is gewijzigd. Bevestig opnieuw." },
    };
  }
  if (input.clientGrossCents != null && Number(input.clientGrossCents) !== quote.grossCents) {
    return {
      ok: false as const,
      status: 409,
      errors: { quote: "Het bedrag op het scherm wijkt af. Bevestig het serverbedrag." },
      serverGrossCents: quote.grossCents,
    };
  }
  const publicName = plainText(typeof input.publicName === "string" ? input.publicName : "");
  if (publicName.length < 2 || publicName.length > 80) return fieldError("publicName", "Vul de publieke naam in (2–80 tekens).");
  let destination: string;
  try {
    const checked = validateDestination(input.destinationUrl);
    if (!checked) return fieldError("destinationUrl", "Vul een https-website in.");
    destination = checked;
  } catch (error) {
    return fieldError("destinationUrl", error instanceof Error ? error.message : "Vul een https-website in.");
  }
  if (typeof input.logoId !== "string" || !readLogo(input.logoId)) return fieldError("logo", "Upload een logo.");
  const billing = validateBilling(input.billing);
  if (!billing.ok) return billing;
  if (input.consent !== true) return fieldError("consent", "Bevestig de incassomachtiging.");
  if (typeof input.attemptId !== "string" || !ATTEMPT.test(input.attemptId)) {
    return fieldError("attempt", "De betaalpoging mist een geldig kenmerk.");
  }

  ensureCommercialSchema();
  const hash = requestHash({
    quote: quoteFingerprint(quote),
    publicName,
    destination,
    logoId: input.logoId,
    billing: billing.value,
  });
  const existing = db().prepare("SELECT * FROM sponsor_checkouts WHERE attempt_id = ?").get(input.attemptId) as
    | CheckoutRow
    | undefined;
  if (existing) {
    if (existing.request_hash !== hash) {
      return { ok: false as const, status: 409, errors: { attempt: "Deze poging hoort bij een andere aanvraag." } };
    }
    if (existing.status === "expired" || existing.status === "canceled" || existing.status === "failed") {
      return {
        ok: false as const,
        status: 409,
        errors: { attempt: "Deze poging is afgesloten. Start een nieuwe poging voor dezelfde offerte." },
      };
    }
    if (!existing.checkout_url) return attachProvider(existing, input.origin);
    return { ok: true as const, reused: true, checkout: publicCheckout(existing) };
  }
  const incomplete = db()
    .prepare("SELECT * FROM sponsor_checkouts WHERE request_hash = ? AND checkout_url = '' AND status = 'open' ORDER BY created_at LIMIT 1")
    .get(hash) as CheckoutRow | undefined;
  if (incomplete) return attachProvider(incomplete, input.origin);

  const checkoutId = randomUUID();
  const sponsorId = randomUUID();
  const contractId = randomUUID();
  const billingId = randomUUID();
  const returnToken = randomBytes(24).toString("base64url");
  const stamp = now.toISOString();
  const anchor = amsterdamDate(now).day;
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const again = database.prepare("SELECT * FROM sponsor_checkouts WHERE attempt_id = ?").get(input.attemptId) as
      | CheckoutRow
      | undefined;
    if (again) {
      database.exec("COMMIT");
      return { ok: true as const, reused: true, checkout: publicCheckout(again) };
    }
    database
      .prepare(
        `INSERT INTO sponsor_profiles (
          id, owner_user_id, public_name, destination_url, logo_id, moderation_status, moderation_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
      )
      .run(sponsorId, input.ownerUserId ?? null, publicName, destination, input.logoId, stamp, stamp);
    database
      .prepare(
        `INSERT INTO sponsor_billing_profiles (
          id, sponsor_id, legal_name, street, postal_code, city, country, vat_id, invoice_email, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        billingId,
        sponsorId,
        billing.value.legalName,
        billing.value.street,
        billing.value.postalCode,
        billing.value.city,
        billing.value.country,
        billing.value.vatId,
        billing.value.invoiceEmail,
        stamp,
      );
    database
      .prepare(
        `INSERT INTO sponsor_contracts (
          id, sponsor_id, quote_id, rate_version, rate_cents, currency, status, anchor_day, contract_date,
          paid_until, consent_version, consent_at, cancel_effective_at, pending_sport_ids, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'EUR', 'draft', ?, ?, NULL, ?, ?, NULL, NULL, ?, ?)`,
      )
      .run(
        contractId,
        sponsorId,
        quote.id,
        quote.rateVersion,
        quote.rateCents,
        anchor,
        amsterdamToday(now),
        CONSENT_VERSION,
        stamp,
        stamp,
        stamp,
      );
    database
      .prepare(
        `INSERT INTO sponsor_checkouts (
          id, attempt_id, quote_id, sponsor_id, contract_id, request_hash, mollie_customer_id, mollie_payment_id,
          mollie_mandate_id, kind, amount_cents, currency, mode, status, checkout_url, return_token, environment,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'first', ?, 'EUR', 'test', 'open', '', ?, 'test', ?, ?)`,
      )
      .run(checkoutId, input.attemptId, quote.id, sponsorId, contractId, hash, quote.grossCents, returnToken, stamp, stamp);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    const raced = db().prepare("SELECT * FROM sponsor_checkouts WHERE attempt_id = ?").get(input.attemptId) as
      | CheckoutRow
      | undefined;
    if (raced) return { ok: true as const, reused: true, checkout: publicCheckout(raced) };
    throw error;
  }

  const row = db().prepare("SELECT * FROM sponsor_checkouts WHERE id = ?").get(checkoutId) as CheckoutRow;
  const attached = await attachProvider(row, input.origin);
  if (!attached.ok) return attached;
  return { ok: true as const, reused: false, checkout: attached.checkout };
}

async function attachProvider(row: CheckoutRow, origin: string) {
  if (row.checkout_url && row.mollie_payment_id) {
    return { ok: true as const, reused: true, checkout: publicCheckout(row) };
  }
  const billing = db()
    .prepare("SELECT legal_name, invoice_email FROM sponsor_billing_profiles WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(row.sponsor_id) as { legal_name: string; invoice_email: string } | undefined;
  if (!billing) {
    return {
      ok: false as const,
      status: 502,
      errors: { form: "Factuurprofiel ontbreekt voor deze poging." },
      attemptId: row.attempt_id,
    };
  }
  try {
    let customerId = row.mollie_customer_id;
    let environment: ProviderEnvironment = row.environment === "live" ? "live" : "test";
    if (!customerId) {
      const customer = await createSponsorCustomer({
        localId: row.sponsor_id,
        name: billing.legal_name,
        email: billing.invoice_email,
      });
      customerId = customer.id;
      environment = customer.environment;
      db()
        .prepare("UPDATE sponsor_checkouts SET mollie_customer_id = ?, mode = ?, environment = ?, updated_at = ? WHERE id = ? AND mollie_customer_id IS NULL")
        .run(customerId, environment, environment, new Date().toISOString(), row.id);
    }
    const payment = await createFirstIdealPayment({
      checkoutId: row.id,
      customerId,
      amountCents: row.amount_cents,
      origin,
      returnToken: row.return_token,
      description: "WeerSport sportsponsoring",
    });
    if (!payment.checkoutUrl) throw new Error("De provider gaf geen betaaladres terug.");
    db()
      .prepare(
        `UPDATE sponsor_checkouts
         SET mollie_customer_id = ?, mollie_payment_id = ?, checkout_url = ?, mode = ?, environment = ?, status = 'pending', updated_at = ?
         WHERE id = ? AND (mollie_payment_id IS NULL OR checkout_url = '')`,
      )
      .run(customerId, payment.id, payment.checkoutUrl, payment.environment, payment.environment, new Date().toISOString(), row.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Providerfout";
    rememberOperation(`payment:${row.id}`, "reconcile_payment", { checkoutId: row.id, error: message.slice(0, 180) });
    return {
      ok: false as const,
      status: 502,
      errors: { form: "De betaalprovider is niet gestart. Dezelfde poging kan opnieuw." },
      attemptId: row.attempt_id,
    };
  }
  const fresh = db().prepare("SELECT * FROM sponsor_checkouts WHERE id = ?").get(row.id) as CheckoutRow;
  if (!fresh.checkout_url) {
    return {
      ok: false as const,
      status: 502,
      errors: { form: "De betaalprovider is niet gestart. Dezelfde poging kan opnieuw." },
      attemptId: fresh.attempt_id,
    };
  }
  return { ok: true as const, reused: true, checkout: publicCheckout(fresh) };
}

function rememberOperation(opKey: string, kind: string, payload: unknown) {
  ensureCommercialSchema();
  const stamp = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO sponsor_operations (id, op_key, kind, status, lease_until, attempts, next_attempt_at, last_error, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', NULL, 0, ?, NULL, ?, ?, ?)
       ON CONFLICT(op_key) DO NOTHING`,
    )
    .run(randomUUID(), opKey, kind, stamp, JSON.stringify(payload), stamp, stamp);
}

export async function verifySponsorPayment(input: { checkoutId?: string; paymentId?: string; now?: Date }) {
  ensureCommercialSchema();
  const row = (input.checkoutId
    ? db().prepare("SELECT * FROM sponsor_checkouts WHERE id = ?").get(input.checkoutId)
    : db().prepare("SELECT * FROM sponsor_checkouts WHERE mollie_payment_id = ?").get(input.paymentId ?? "")) as
    | CheckoutRow
    | undefined;
  if (!row?.mollie_payment_id) return { ok: false as const, status: 404, error: "Betaling niet gevonden." };
  const payment = await readSponsorPayment(row.mollie_payment_id);
  if (!payment || payment.checkoutId !== row.id) {
    return { ok: false as const, status: 409, error: "De providerbetaling hoort niet bij deze aanvraag." };
  }
  if (payment.environment !== row.environment) {
    return { ok: false as const, status: 409, error: "De betaalomgeving komt niet overeen." };
  }
  if (payment.currency !== "EUR" || payment.amountCents !== row.amount_cents) {
    return { ok: false as const, status: 409, error: "Bedrag of valuta komt niet overeen." };
  }
  const now = input.now ?? new Date();
  if (payment.status === "paid") {
    await applyPaidCheckout(row, payment.mandateId, now);
    const fresh = db().prepare("SELECT * FROM sponsor_checkouts WHERE id = ?").get(row.id) as CheckoutRow;
    return { ok: true as const, checkout: publicCheckout(fresh), mandateId: fresh.mollie_mandate_id };
  }
  if (payment.status === "expired" || payment.status === "canceled" || payment.status === "failed") {
    db()
      .prepare("UPDATE sponsor_checkouts SET status = ?, updated_at = ? WHERE id = ? AND status NOT IN ('paid')")
      .run(payment.status, now.toISOString(), row.id);
  }
  const fresh = db().prepare("SELECT * FROM sponsor_checkouts WHERE id = ?").get(row.id) as CheckoutRow;
  return { ok: true as const, checkout: publicCheckout(fresh), mandateId: fresh.mollie_mandate_id };
}

async function applyPaidCheckout(row: CheckoutRow, mandateId: string | null, now: Date) {
  const database = db();
  const stamp = now.toISOString();
  const contract = database.prepare("SELECT * FROM sponsor_contracts WHERE id = ?").get(row.contract_id) as
    | {
        id: string;
        sponsor_id: string;
        quote_id: string;
        anchor_day: number;
        contract_date: string;
        status: string;
        paid_until: string | null;
        rate_cents: number;
      }
    | undefined;
  if (!contract) return;
  const periodStart = contract.contract_date;
  const periodEnd = nextPeriodStart(periodStart, contract.anchor_day);
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `UPDATE sponsor_checkouts
         SET status = 'paid', mollie_mandate_id = COALESCE(?, mollie_mandate_id), updated_at = ?
         WHERE id = ?`,
      )
      .run(mandateId, stamp, row.id);
    if (contract.status === "draft") {
      database
        .prepare(
          `UPDATE sponsor_contracts
           SET status = 'active', paid_until = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(periodEnd, stamp, contract.id);
      const quote = readQuote(contract.quote_id);
      for (const sportId of quote?.sportIds ?? []) {
        database
          .prepare(
            `INSERT INTO sponsor_contract_sports (contract_id, sport_id, period_start) VALUES (?, ?, ?)
             ON CONFLICT DO NOTHING`,
          )
          .run(contract.id, sportId, periodStart);
      }
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  const fresh = database.prepare("SELECT * FROM sponsor_checkouts WHERE id = ?").get(row.id) as CheckoutRow;
  if (!fresh.mollie_mandate_id) {
    rememberOperation(`mandate:${row.id}`, "mandate_recovery", { checkoutId: row.id });
  }
  try {
    await ensureFirstInvoice(fresh, periodStart, periodEnd, now);
  } catch (error) {
    rememberOperation(`invoice:${contract.id}:${periodStart}`, "invoice_retry", {
      contractId: contract.id,
      error: error instanceof Error ? error.message.slice(0, 180) : "factuurfout",
    });
  }
}

export async function ensureFirstInvoice(row: CheckoutRow, periodStart: string, periodEnd: string, now = new Date()) {
  if (!row.contract_id || !row.mollie_customer_id || !row.mollie_payment_id) return null;
  return createPeriodInvoice({
    contractId: row.contract_id,
    periodStart,
    periodEnd,
    kind: "first_paid",
    customerId: row.mollie_customer_id,
    paymentId: row.mollie_payment_id,
    mandateId: row.mollie_mandate_id,
    now,
  });
}

export async function createPeriodInvoice(input: {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  kind: "first_paid" | "collection";
  customerId: string;
  paymentId?: string | null;
  mandateId?: string | null;
  now?: Date;
}) {
  ensureCommercialSchema();
  const existing = db()
    .prepare("SELECT * FROM sponsor_invoice_periods WHERE contract_id = ? AND period_start = ?")
    .get(input.contractId, input.periodStart) as { id: string; provider_invoice_id: string | null; status: string } | undefined;
  if (existing?.provider_invoice_id) return existing;
  const contract = db().prepare("SELECT * FROM sponsor_contracts WHERE id = ?").get(input.contractId) as
    | { id: string; sponsor_id: string; rate_cents: number; anchor_day: number }
    | undefined;
  if (!contract) return null;
  const sports = db()
    .prepare("SELECT sport_id FROM sponsor_contract_sports WHERE contract_id = ? AND period_start = ? ORDER BY sport_id")
    .all(input.contractId, input.periodStart) as Array<{ sport_id: string }>;
  const lines = buildLines(
    sports.map((sport) => sport.sport_id),
    contract.rate_cents,
  );
  const recipient = db()
    .prepare("SELECT * FROM sponsor_billing_profiles WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(contract.sponsor_id) as Record<string, unknown> | undefined;
  const invoiceId = existing?.id ?? randomUUID();
  const stamp = (input.now ?? new Date()).toISOString();
  const seller = sellerSnapshot();
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const raced = database
      .prepare("SELECT * FROM sponsor_invoice_periods WHERE contract_id = ? AND period_start = ?")
      .get(input.contractId, input.periodStart) as { id: string; provider_invoice_id: string | null } | undefined;
    if (raced?.provider_invoice_id) {
      database.exec("COMMIT");
      return raced;
    }
    if (!raced) {
      database
        .prepare(
          `INSERT INTO sponsor_invoice_periods (
            id, contract_id, period_start, period_end, lines_json, net_cents, vat_cents, gross_cents,
            recipient_json, seller_json, provider_invoice_id, invoice_number, status, email_status, payment_ref, kind, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'draft', 'not_requested', ?, ?, ?)`,
        )
        .run(
          invoiceId,
          input.contractId,
          input.periodStart,
          input.periodEnd,
          JSON.stringify(lines),
          lines.reduce((sum, line) => sum + line.netCents, 0),
          lines.reduce((sum, line) => sum + line.vatCents, 0),
          lines.reduce((sum, line) => sum + line.grossCents, 0),
          JSON.stringify(recipientSnapshot(recipient)),
          JSON.stringify(seller),
          input.paymentId ?? null,
          input.kind,
          stamp,
        );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    const raced = db()
      .prepare("SELECT * FROM sponsor_invoice_periods WHERE contract_id = ? AND period_start = ?")
      .get(input.contractId, input.periodStart) as { id: string; provider_invoice_id: string | null } | undefined;
    if (raced?.provider_invoice_id) return raced;
    if (raced) {
      return finishProviderInvoice(raced.id, input, lines);
    }
    throw error;
  }
  return finishProviderInvoice(invoiceId, input, lines);
}

export async function recoverPendingInvoices(now = new Date()) {
  ensureCommercialSchema();
  const stuck = db()
    .prepare(
      `SELECT id, contract_id, period_start, period_end, kind, payment_ref
       FROM sponsor_invoice_periods
       WHERE provider_invoice_id IS NULL AND status IN ('issuing', 'draft')`,
    )
    .all() as Array<{
    id: string;
    contract_id: string;
    period_start: string;
    period_end: string;
    kind: string;
    payment_ref: string | null;
  }>;
  const ops = db()
    .prepare("SELECT op_key FROM sponsor_operations WHERE kind = 'invoice_retry' AND status = 'pending'")
    .all() as Array<{ op_key: string }>;
  const targets = new Map<string, { contractId: string; periodStart: string; periodEnd?: string; kind?: string; paymentRef?: string | null }>();
  for (const row of stuck) {
    targets.set(`${row.contract_id}:${row.period_start}`, {
      contractId: row.contract_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      kind: row.kind,
      paymentRef: row.payment_ref,
    });
  }
  for (const op of ops) {
    const match = /^invoice:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(op.op_key);
    if (!match) continue;
    const key = `${match[1]}:${match[2]}`;
    if (!targets.has(key)) targets.set(key, { contractId: match[1], periodStart: match[2] });
  }
  for (const target of targets.values()) {
    const checkout = db()
      .prepare(
        `SELECT mollie_customer_id, mollie_mandate_id, mollie_payment_id
         FROM sponsor_checkouts WHERE contract_id = ? AND status = 'paid' ORDER BY created_at LIMIT 1`,
      )
      .get(target.contractId) as { mollie_customer_id: string | null; mollie_mandate_id: string | null; mollie_payment_id: string | null } | undefined;
    const period = db()
      .prepare("SELECT period_end, kind, payment_ref, provider_invoice_id FROM sponsor_invoice_periods WHERE contract_id = ? AND period_start = ?")
      .get(target.contractId, target.periodStart) as
      | { period_end: string; kind: string; payment_ref: string | null; provider_invoice_id: string | null }
      | undefined;
    if (!checkout?.mollie_customer_id || !period) continue;
    const opKey = `invoice:${target.contractId}:${target.periodStart}`;
    try {
      await createPeriodInvoice({
        contractId: target.contractId,
        periodStart: target.periodStart,
        periodEnd: period.period_end,
        kind: period.kind === "collection" ? "collection" : "first_paid",
        customerId: checkout.mollie_customer_id,
        paymentId: period.payment_ref ?? checkout.mollie_payment_id,
        mandateId: checkout.mollie_mandate_id,
        now,
      });
      const done = db()
        .prepare("SELECT provider_invoice_id FROM sponsor_invoice_periods WHERE contract_id = ? AND period_start = ?")
        .get(target.contractId, target.periodStart) as { provider_invoice_id: string | null } | undefined;
      if (done?.provider_invoice_id) {
        db().prepare("UPDATE sponsor_operations SET status = 'done', updated_at = ? WHERE op_key = ?").run(now.toISOString(), opKey);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 180) : "factuurfout";
      db()
        .prepare("UPDATE sponsor_operations SET attempts = attempts + 1, last_error = ?, updated_at = ? WHERE op_key = ?")
        .run(message, now.toISOString(), opKey);
    }
  }
}

function recipientSnapshot(row: Record<string, unknown> | undefined) {
  if (!row) return {};
  return {
    legalName: row.legal_name,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    vatId: row.vat_id,
    invoiceEmail: row.invoice_email,
  };
}

export function invoiceLineDescription(sportName: string, periodStart: string, periodEnd: string) {
  return `${sportName} · ${formatPeriodLabel(periodStart, periodEnd)}`;
}

async function finishProviderInvoice(
  invoiceId: string,
  input: {
    contractId: string;
    kind: "first_paid" | "collection";
    customerId: string;
    paymentId?: string | null;
    mandateId?: string | null;
    periodStart: string;
    periodEnd: string;
  },
  lines: QuoteLine[],
) {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const current = database.prepare("SELECT provider_invoice_id, status FROM sponsor_invoice_periods WHERE id = ?").get(invoiceId) as
      | { provider_invoice_id: string | null; status: string }
      | undefined;
    if (!current || current.provider_invoice_id) {
      database.exec("COMMIT");
      return current ?? null;
    }
    if (current.status !== "issuing") {
      database.prepare("UPDATE sponsor_invoice_periods SET status = 'issuing' WHERE id = ? AND provider_invoice_id IS NULL").run(invoiceId);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  const subject = `WeerSport-factuur · ${input.periodStart}`;
  const provider = await createSalesInvoice({
    localInvoiceId: invoiceId,
    customerId: input.customerId,
    paymentId: input.paymentId,
    mandateId: input.mandateId,
    kind: input.kind,
    lines: lines.map((line) => ({
      description: invoiceLineDescription(line.sportName, input.periodStart, input.periodEnd),
      netCents: line.netCents,
      vatRate: line.vatRate,
    })),
    subject,
  });
  const status = input.kind === "first_paid" ? "paid" : "collection_pending";
  db()
    .prepare(
      `UPDATE sponsor_invoice_periods
       SET provider_invoice_id = ?, invoice_number = ?, status = ?, email_status = ?
       WHERE id = ? AND provider_invoice_id IS NULL`,
    )
    .run(provider.id, provider.number, status, provider.emailStatus, invoiceId);
  db()
    .prepare("UPDATE sponsor_operations SET status = 'done', updated_at = ? WHERE op_key = ? AND status = 'pending'")
    .run(new Date().toISOString(), `invoice:${input.contractId}:${input.periodStart}`);
  return db().prepare("SELECT * FROM sponsor_invoice_periods WHERE id = ?").get(invoiceId);
}

export function checkoutByReturnToken(token: string) {
  ensureCommercialSchema();
  if (!token || token.length < 20) return null;
  return db().prepare("SELECT * FROM sponsor_checkouts WHERE return_token = ?").get(token) as CheckoutRow | undefined;
}

export function paymentStatusView(token: string) {
  const row = checkoutByReturnToken(token);
  if (!row?.contract_id) return null;
  const contract = db().prepare("SELECT * FROM sponsor_contracts WHERE id = ?").get(row.contract_id) as
    | { quote_id: string; paid_until: string | null; status: string; sponsor_id: string }
    | undefined;
  const quote = contract ? readQuote(contract.quote_id) : null;
  const billing = db()
    .prepare("SELECT * FROM sponsor_billing_profiles WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(row.sponsor_id) as
    | {
        legal_name: string;
        street: string;
        postal_code: string;
        city: string;
        country: string;
        invoice_email: string;
      }
    | undefined;
  const invoice = db()
    .prepare("SELECT status, email_status, invoice_number, kind FROM sponsor_invoice_periods WHERE contract_id = ? ORDER BY period_start LIMIT 1")
    .get(row.contract_id) as
    | { status: string; email_status: string; invoice_number: string | null; kind: string }
    | undefined;
  const profile = db().prepare("SELECT moderation_status, moderation_reason, public_name FROM sponsor_profiles WHERE id = ?").get(row.sponsor_id) as
    | { moderation_status: string; moderation_reason: string | null; public_name: string }
    | undefined;
  return {
    status: row.status,
    mode: row.mode,
    sports: quote?.lines.map((line) => line.sportName) ?? [],
    grossCents: row.amount_cents,
    paidUntil: contract?.paid_until ?? null,
    contractStatus: contract?.status ?? "draft",
    mandate: Boolean(row.mollie_mandate_id),
    moderation: profile?.moderation_status ?? "pending",
    moderationReason: profile?.moderation_reason ?? null,
    publicName: profile?.public_name ?? "",
    billing: billing
      ? {
          legalName: billing.legal_name,
          street: billing.street,
          postalCode: billing.postal_code,
          city: billing.city,
          country: billing.country,
          invoiceEmail: billing.invoice_email,
        }
      : null,
    invoice: invoice ?? null,
    sponsorId: row.sponsor_id,
  };
}
