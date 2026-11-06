import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import {
  BILLING_DISCLOSURE,
  PRO_CURRENCY,
  PRO_PRICE_CENTS,
  PRO_PRICE_EUR,
  type BillingState,
} from "@/lib/billing/constants";
import { ensureBasisSubscription, getEntitlement, isProActive } from "@/lib/billing/entitlement";
import {
  billingMode,
  billingModeLabel,
  CHECKOUT_DISABLED_MESSAGE,
  checkoutEnabled,
  rawMollieApiKey,
  usesMollieApi,
  type MollieBillingMode,
} from "@/lib/billing/mollie-mode";
import { addDaysIso } from "@/lib/billing/period";
import { ensureBillingSchema } from "@/lib/billing/schema";

export type CheckoutSession = {
  id: string;
  state: BillingState;
  checkoutUrl: string;
  amount: string;
  currency: string;
  mode: MollieBillingMode;
  disclosure: string;
};

export {
  billingMode,
  billingModeLabel,
  checkoutEnabled,
  CHECKOUT_DISABLED_MESSAGE,
  usesMollieApi,
};

/** Compat for older callers: sandbox vs remote API. */
export function mollieMode(): "live-api" | "sandbox-local" | "disabled" {
  const mode = billingMode();
  if (mode === "sandbox-local") return "sandbox-local";
  if (mode === "disabled") return "disabled";
  return "live-api";
}

function nowIso() {
  return new Date().toISOString();
}

async function mollieFetch(path: string, init?: RequestInit) {
  const key = rawMollieApiKey();
  if (!key) throw new Error("MOLLIE_API_KEY ontbreekt");
  const response = await fetch(`https://api.mollie.com/v2${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Mollie HTTP ${response.status}`);
  }
  return body as Record<string, unknown>;
}

function getCustomer(userId: string) {
  return db()
    .prepare("SELECT * FROM billing_customers WHERE user_id = ?")
    .get(userId) as { mollie_customer_id: string | null; mode: string } | undefined;
}

function upsertCustomer(userId: string, mollieCustomerId: string | null, mode: string) {
  const stamp = nowIso();
  db()
    .prepare(
      `INSERT INTO billing_customers (user_id, mollie_customer_id, mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         mollie_customer_id = excluded.mollie_customer_id,
         mode = excluded.mode,
         updated_at = excluded.updated_at`,
    )
    .run(userId, mollieCustomerId, mode, stamp, stamp);
}

export async function createProCheckout(input: {
  userId: string;
  email: string;
  name: string;
  consent: boolean;
  origin: string;
  idempotencyKey?: string;
}): Promise<{ ok: true; checkout: CheckoutSession } | { ok: false; error: string; status: number }> {
  ensureBillingSchema();
  ensureBasisSubscription(input.userId);
  if (!checkoutEnabled()) {
    return { ok: false, status: 503, error: CHECKOUT_DISABLED_MESSAGE };
  }
  if (!input.consent) {
    return { ok: false, status: 400, error: "Bevestig akkoord voor doorlopende Pro-betaling via Mollie." };
  }
  if (isProActive(input.userId)) {
    return { ok: false, status: 409, error: "Je hebt al een actieve Pro-periode." };
  }

  const mode = billingMode();

  if (input.idempotencyKey) {
    const existing = db()
      .prepare("SELECT * FROM billing_checkouts WHERE idempotency_key = ? AND user_id = ?")
      .get(input.idempotencyKey, input.userId) as
      | {
          id: string;
          state: string;
          checkout_url: string | null;
        }
      | undefined;
    if (existing?.checkout_url) {
      return {
        ok: true,
        checkout: {
          id: existing.id,
          state: existing.state as BillingState,
          checkoutUrl: existing.checkout_url,
          amount: PRO_PRICE_EUR,
          currency: PRO_CURRENCY,
          mode,
          disclosure: BILLING_DISCLOSURE,
        },
      };
    }
  }

  const checkoutId = randomUUID();
  const stamp = nowIso();
  let mollieCustomerId: string | null = getCustomer(input.userId)?.mollie_customer_id ?? null;
  let molliePaymentId: string | null = null;
  let mollieMandateId: string | null = null;
  let checkoutUrl = `${input.origin}/checkout/betaal-simulatie?checkout=${checkoutId}`;
  let state: BillingState = "checkout_created";

  if (usesMollieApi()) {
    if (!mollieCustomerId) {
      const customer = await mollieFetch("/customers", {
        method: "POST",
        body: JSON.stringify({ name: input.name, email: input.email, metadata: { userId: input.userId } }),
      });
      mollieCustomerId = String(customer.id);
      upsertCustomer(input.userId, mollieCustomerId, mode);
    }
    const payment = await mollieFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: { currency: PRO_CURRENCY, value: PRO_PRICE_EUR },
        description: "WeerSport Pro · maandabonnement",
        redirectUrl: `${input.origin}/checkout/pending?checkout=${checkoutId}`,
        webhookUrl: `${input.origin}/api/billing/webhook`,
        customerId: mollieCustomerId,
        sequenceType: "first",
        metadata: { userId: input.userId, checkoutId },
      }),
    });
    molliePaymentId = String(payment.id);
    mollieMandateId = payment.mandateId ? String(payment.mandateId) : null;
    const links = payment._links as { checkout?: { href?: string } } | undefined;
    checkoutUrl = links?.checkout?.href ?? checkoutUrl;
    state = "payment_pending";
  } else {
    upsertCustomer(input.userId, `cst_local_${input.userId.slice(0, 8)}`, mode);
    mollieCustomerId = `cst_local_${input.userId.slice(0, 8)}`;
    molliePaymentId = `tr_local_${checkoutId.slice(0, 12)}`;
    mollieMandateId = `mdt_local_${checkoutId.slice(0, 8)}`;
    state = "payment_pending";
  }

  db()
    .prepare(
      `INSERT INTO billing_checkouts (
        id, user_id, mollie_payment_id, mollie_customer_id, amount_cents, currency, state,
        checkout_url, consent_at, idempotency_key, raw_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      checkoutId,
      input.userId,
      molliePaymentId,
      mollieCustomerId,
      PRO_PRICE_CENTS,
      PRO_CURRENCY,
      state,
      checkoutUrl,
      stamp,
      input.idempotencyKey ?? null,
      state,
      stamp,
      stamp,
    );

  if (mollieMandateId) {
    // Persist mandate identity early; activation fills subscription id + period.
    db()
      .prepare(
        `INSERT INTO billing_subscriptions (
          user_id, plan, state, mollie_subscription_id, mollie_customer_id, mollie_mandate_id,
          current_period_start, current_period_end, cancel_at_period_end, cancelled_at, updated_at, created_at
        ) VALUES (?, 'basis', 'basis', NULL, ?, ?, NULL, NULL, 0, NULL, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          mollie_customer_id = COALESCE(excluded.mollie_customer_id, billing_subscriptions.mollie_customer_id),
          mollie_mandate_id = COALESCE(excluded.mollie_mandate_id, billing_subscriptions.mollie_mandate_id),
          updated_at = excluded.updated_at`,
      )
      .run(input.userId, mollieCustomerId, mollieMandateId, stamp, stamp);
  }

  return {
    ok: true,
    checkout: {
      id: checkoutId,
      state,
      checkoutUrl,
      amount: PRO_PRICE_EUR,
      currency: PRO_CURRENCY,
      mode,
      disclosure: BILLING_DISCLOSURE,
    },
  };
}

function getCheckout(id: string) {
  return db()
    .prepare("SELECT * FROM billing_checkouts WHERE id = ?")
    .get(id) as
    | {
        id: string;
        user_id: string;
        mollie_payment_id: string | null;
        mollie_customer_id: string | null;
        amount_cents: number;
        currency: string;
        state: string;
      }
    | undefined;
}

function getSubscription(userId: string) {
  return db()
    .prepare("SELECT * FROM billing_subscriptions WHERE user_id = ?")
    .get(userId) as
    | {
        plan: string;
        state: string;
        mollie_subscription_id: string | null;
        mollie_customer_id: string | null;
        mollie_mandate_id: string | null;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: number;
      }
    | undefined;
}

function writeInvoice(userId: string, checkoutId: string | null, status: string, description?: string) {
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO billing_invoices (id, user_id, checkout_id, amount_cents, currency, status, description, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      checkoutId,
      PRO_PRICE_CENTS,
      PRO_CURRENCY,
      status,
      description ?? "WeerSport Pro · maandabonnement",
      nowIso(),
    );
  return id;
}

function defaultPeriodEnd(from = new Date()) {
  return addDaysIso(30, from);
}

function activateProAtomic(input: {
  userId: string;
  customerId: string | null;
  checkoutId: string;
  paymentId: string | null;
  subscriptionId?: string | null;
  mandateId?: string | null;
  periodStart?: string;
  periodEnd?: string;
}) {
  const stamp = nowIso();
  const periodStart = input.periodStart ?? stamp;
  const periodEnd = input.periodEnd ?? defaultPeriodEnd(new Date(periodStart));
  const subscriptionId = input.subscriptionId ?? `sub_${input.checkoutId.slice(0, 12)}`;
  const existing = getSubscription(input.userId);
  const mandateId = input.mandateId ?? existing?.mollie_mandate_id ?? null;

  db().exec("BEGIN IMMEDIATE");
  try {
    db()
      .prepare(
        `INSERT INTO billing_subscriptions (
          user_id, plan, state, mollie_subscription_id, mollie_customer_id, mollie_mandate_id,
          current_period_start, current_period_end, cancel_at_period_end, cancelled_at, updated_at, created_at
        ) VALUES (?, 'pro', 'subscription_active', ?, ?, ?, ?, ?, 0, NULL, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          plan = 'pro',
          state = 'subscription_active',
          mollie_subscription_id = excluded.mollie_subscription_id,
          mollie_customer_id = excluded.mollie_customer_id,
          mollie_mandate_id = COALESCE(excluded.mollie_mandate_id, billing_subscriptions.mollie_mandate_id),
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = 0,
          cancelled_at = NULL,
          updated_at = excluded.updated_at`,
      )
      .run(
        input.userId,
        subscriptionId,
        input.customerId,
        mandateId,
        periodStart,
        periodEnd,
        stamp,
        stamp,
      );
    db()
      .prepare("UPDATE billing_checkouts SET state = ?, raw_status = ?, updated_at = ? WHERE id = ?")
      .run("payment_paid", "paid", stamp, input.checkoutId);
    writeInvoice(input.userId, input.checkoutId, "paid");
    db().exec("COMMIT");
  } catch (error) {
    try {
      db().exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }

  return { periodStart, periodEnd, subscriptionId, mandateId };
}

function failCheckout(checkoutId: string, raw: string) {
  db()
    .prepare("UPDATE billing_checkouts SET state = ?, raw_status = ?, updated_at = ? WHERE id = ?")
    .run("payment_failed", raw, nowIso(), checkoutId);
}

export function transitionEventId(paymentId: string, status: string) {
  return `mollie:payment:${paymentId}:status:${status}`;
}

function alreadyProcessed(providerEventId: string) {
  return db()
    .prepare("SELECT id FROM billing_webhook_events WHERE provider_event_id = ?")
    .get(providerEventId) as { id: string } | undefined;
}

function recordProcessed(providerEventId: string, paymentId: string | null, payload: unknown) {
  db()
    .prepare(
      `INSERT INTO billing_webhook_events (id, provider_event_id, payment_id, processed_at, payload_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), providerEventId, paymentId, nowIso(), JSON.stringify(payload));
}

/**
 * Verify provider payment status server-side, then apply entitlement changes idempotently.
 * Durable duplicate key = payment id + verified status transition (not a random delivery id).
 */
export async function verifyAndApplyPayment(input: {
  checkoutId: string;
  expectedUserId?: string;
  simulatedStatus?: "paid" | "failed" | "canceled" | "pending" | "expired";
  /** Override durable key; defaults to payment+status. */
  providerEventId?: string;
}) {
  ensureBillingSchema();
  const checkout = getCheckout(input.checkoutId);
  if (!checkout) return { ok: false as const, status: 404, error: "Checkout niet gevonden." };
  if (input.expectedUserId && checkout.user_id !== input.expectedUserId) {
    return { ok: false as const, status: 403, error: "Checkout hoort niet bij dit account." };
  }

  const sub = getSubscription(checkout.user_id);

  let providerStatus: string = input.simulatedStatus ?? "pending";
  let mandateId: string | null = sub?.mollie_mandate_id ?? null;
  let subscriptionId: string | null = sub?.mollie_subscription_id ?? null;
  const periodEnd: string | null = null;

  if (usesMollieApi() && checkout.mollie_payment_id) {
    const payment = await mollieFetch(`/payments/${checkout.mollie_payment_id}`);
    const amount = payment.amount as { value?: string; currency?: string } | undefined;
    if (amount?.currency !== PRO_CURRENCY || amount?.value !== PRO_PRICE_EUR) {
      return { ok: false as const, status: 409, error: "Mollie-bedrag of valuta komt niet overeen." };
    }
    const metadata = payment.metadata as { userId?: string; checkoutId?: string } | undefined;
    if (metadata?.userId && metadata.userId !== checkout.user_id) {
      return { ok: false as const, status: 409, error: "Mollie-metadata komt niet overeen." };
    }
    providerStatus = String(payment.status);
    if (payment.mandateId) mandateId = String(payment.mandateId);
    if (payment.subscriptionId) subscriptionId = String(payment.subscriptionId);
  }

  const paymentId = checkout.mollie_payment_id ?? `checkout:${checkout.id}`;
  const providerEventId = input.providerEventId ?? transitionEventId(paymentId, providerStatus);

  if (alreadyProcessed(providerEventId)) {
    return {
      ok: true as const,
      state: checkout.state,
      entitlement: getEntitlement(checkout.user_id),
      duplicate: true,
      ignored: false,
    };
  }

  // Out-of-order: never resurrect a refunded subscription via a late paid event.
  if (providerStatus === "paid" && (sub?.state === "refunded" || checkout.state === "refunded")) {
    recordProcessed(providerEventId, paymentId, {
      checkoutId: checkout.id,
      providerStatus,
      ignored: "out-of-order-after-refund",
    });
    return {
      ok: true as const,
      state: "refunded",
      entitlement: getEntitlement(checkout.user_id),
      duplicate: false,
      ignored: true,
    };
  }

  if (providerStatus === "paid") {
    if (checkout.state === "payment_paid" && isProActive(checkout.user_id)) {
      recordProcessed(providerEventId, paymentId, { checkoutId: checkout.id, providerStatus, duplicate: true });
      return {
        ok: true as const,
        state: "payment_paid",
        entitlement: getEntitlement(checkout.user_id),
        duplicate: true,
        ignored: false,
      };
    }
    const activated = activateProAtomic({
      userId: checkout.user_id,
      customerId: checkout.mollie_customer_id,
      checkoutId: checkout.id,
      paymentId,
      subscriptionId,
      mandateId,
      periodEnd: periodEnd ?? undefined,
    });
    recordProcessed(providerEventId, paymentId, {
      checkoutId: checkout.id,
      providerStatus,
      periodEnd: activated.periodEnd,
      subscriptionId: activated.subscriptionId,
    });
    return {
      ok: true as const,
      state: "payment_paid",
      entitlement: getEntitlement(checkout.user_id),
      duplicate: false,
      ignored: false,
    };
  }

  if (providerStatus === "failed" || providerStatus === "canceled" || providerStatus === "expired") {
    // Do not downgrade an already-paid checkout on a late failure (out-of-order).
    if (checkout.state === "payment_paid" || isProActive(checkout.user_id)) {
      recordProcessed(providerEventId, paymentId, {
        checkoutId: checkout.id,
        providerStatus,
        ignored: "out-of-order-after-paid",
      });
      return {
        ok: true as const,
        state: "payment_paid",
        entitlement: getEntitlement(checkout.user_id),
        duplicate: false,
        ignored: true,
      };
    }
    failCheckout(checkout.id, providerStatus);
    recordProcessed(providerEventId, paymentId, { checkoutId: checkout.id, providerStatus });
    return {
      ok: true as const,
      state: providerStatus === "canceled" ? "cancelled" : "payment_failed",
      entitlement: getEntitlement(checkout.user_id),
      duplicate: false,
      ignored: false,
    };
  }

  db()
    .prepare("UPDATE billing_checkouts SET state = ?, raw_status = ?, updated_at = ? WHERE id = ?")
    .run("payment_pending", providerStatus, nowIso(), checkout.id);
  recordProcessed(providerEventId, paymentId, { checkoutId: checkout.id, providerStatus });
  return {
    ok: true as const,
    state: "payment_pending",
    entitlement: getEntitlement(checkout.user_id),
    duplicate: false,
    ignored: false,
  };
}

/** Sandbox/test renewal: extend paid-through and append invoice. */
export function applyRenewal(input: {
  userId: string;
  providerPaymentId?: string;
  periodEnd?: string;
}) {
  ensureBillingSchema();
  const sub = getSubscription(input.userId);
  if (!sub || sub.plan !== "pro") {
    return { ok: false as const, status: 400, error: "Geen Pro-abonnement om te verlengen." };
  }
  if (sub.state === "refunded" || sub.state === "cancelled") {
    return { ok: false as const, status: 409, error: "Beëindigd abonnement kan niet worden verlengd." };
  }
  const paymentId = input.providerPaymentId ?? `tr_renew_${randomUUID().slice(0, 10)}`;
  const eventId = transitionEventId(paymentId, "paid-renewal");
  if (alreadyProcessed(eventId)) {
    return {
      ok: true as const,
      duplicate: true,
      entitlement: getEntitlement(input.userId),
    };
  }

  const stamp = nowIso();
  const base = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  const periodEnd = input.periodEnd ?? addDaysIso(30, base.getTime() > Date.now() ? base : new Date());

  db().exec("BEGIN IMMEDIATE");
  try {
    db()
      .prepare(
        `UPDATE billing_subscriptions
         SET state = 'subscription_active', current_period_end = ?, cancel_at_period_end = 0,
             cancelled_at = NULL, updated_at = ?
         WHERE user_id = ?`,
      )
      .run(periodEnd, stamp, input.userId);
    writeInvoice(input.userId, null, "paid", "WeerSport Pro · verlenging");
    recordProcessed(eventId, paymentId, { userId: input.userId, periodEnd, kind: "renewal" });
    db().exec("COMMIT");
  } catch (error) {
    try {
      db().exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }

  return {
    ok: true as const,
    duplicate: false,
    entitlement: getEntitlement(input.userId),
    periodEnd,
  };
}

/** Failed collection / past_due without immediately ending access until period end. */
export function applyFailedCollection(input: { userId: string; providerPaymentId?: string }) {
  ensureBillingSchema();
  const sub = getSubscription(input.userId);
  if (!sub || sub.plan !== "pro") {
    return { ok: false as const, status: 400, error: "Geen Pro-abonnement." };
  }
  const paymentId = input.providerPaymentId ?? `tr_fail_${randomUUID().slice(0, 10)}`;
  const eventId = transitionEventId(paymentId, "failed-collection");
  if (alreadyProcessed(eventId)) {
    return { ok: true as const, duplicate: true, entitlement: getEntitlement(input.userId) };
  }
  const stamp = nowIso();
  db().exec("BEGIN IMMEDIATE");
  try {
    db()
      .prepare(`UPDATE billing_subscriptions SET state = 'past_due', updated_at = ? WHERE user_id = ?`)
      .run(stamp, input.userId);
    recordProcessed(eventId, paymentId, { userId: input.userId, kind: "failed-collection" });
    db().exec("COMMIT");
  } catch (error) {
    try {
      db().exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }
  return { ok: true as const, duplicate: false, entitlement: getEntitlement(input.userId) };
}

export function requestCancel(userId: string) {
  ensureBillingSchema();
  const row = getSubscription(userId);
  if (!row || row.plan !== "pro" || !isProActive(userId)) {
    return { ok: false as const, error: "Geen actieve Pro-abonnement om op te zeggen.", status: 400 };
  }
  db()
    .prepare(
      `UPDATE billing_subscriptions
       SET state = 'cancel_requested', cancel_at_period_end = 1, cancelled_at = ?, updated_at = ?
       WHERE user_id = ?`,
    )
    .run(nowIso(), nowIso(), userId);
  return {
    ok: true as const,
    message:
      "Opzegging ontvangen. Pro blijft actief tot het einde van de betaalde periode; er volgt geen automatische verlenging zonder provider-renewal.",
    entitlement: getEntitlement(userId),
  };
}

export function listInvoices(userId: string) {
  ensureBillingSchema();
  return db()
    .prepare("SELECT * FROM billing_invoices WHERE user_id = ? ORDER BY issued_at DESC")
    .all(userId) as Array<{
    id: string;
    amount_cents: number;
    currency: string;
    status: string;
    description: string;
    issued_at: string;
  }>;
}

export function getCheckoutPublic(checkoutId: string, userId: string) {
  ensureBillingSchema();
  const row = getCheckout(checkoutId);
  if (!row || row.user_id !== userId) return null;
  return row;
}

export function getProviderIdentities(userId: string) {
  ensureBillingSchema();
  const customer = getCustomer(userId);
  const sub = getSubscription(userId);
  return {
    mode: billingMode(),
    customerId: customer?.mollie_customer_id ?? null,
    subscriptionId: sub?.mollie_subscription_id ?? null,
    mandateId: sub?.mollie_mandate_id ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    state: sub?.state ?? null,
  };
}

/**
 * Refund path. Marks the paid invoice as refunded and ends Pro immediately.
 * Durable on invoice id transition.
 */
export function applyRefund(input: { userId: string; invoiceId?: string }) {
  ensureBillingSchema();
  const invoice = input.invoiceId
    ? (db()
        .prepare("SELECT * FROM billing_invoices WHERE id = ? AND user_id = ?")
        .get(input.invoiceId, input.userId) as
        | { id: string; status: string; checkout_id: string | null }
        | undefined)
    : (db()
        .prepare(
          "SELECT * FROM billing_invoices WHERE user_id = ? AND status = 'paid' ORDER BY issued_at DESC LIMIT 1",
        )
        .get(input.userId) as { id: string; status: string; checkout_id: string | null } | undefined);

  if (!invoice) {
    return { ok: false as const, status: 404, error: "Geen betaalde factuur gevonden voor terugbetaling." };
  }
  const eventId = `mollie:invoice:${invoice.id}:status:refunded`;
  if (alreadyProcessed(eventId) || invoice.status === "refunded") {
    return {
      ok: true as const,
      duplicate: true,
      invoiceId: invoice.id,
      entitlement: getEntitlement(input.userId),
    };
  }
  if (invoice.status !== "paid") {
    return { ok: false as const, status: 400, error: "Alleen betaalde facturen kunnen worden terugbetaald." };
  }

  const stamp = nowIso();
  db().exec("BEGIN IMMEDIATE");
  try {
    db().prepare("UPDATE billing_invoices SET status = 'refunded' WHERE id = ?").run(invoice.id);
    if (invoice.checkout_id) {
      db()
        .prepare("UPDATE billing_checkouts SET state = ?, raw_status = ?, updated_at = ? WHERE id = ?")
        .run("refunded", "refunded", stamp, invoice.checkout_id);
    }
    db()
      .prepare(
        `UPDATE billing_subscriptions
         SET plan = 'basis', state = 'refunded', current_period_end = ?, cancel_at_period_end = 0,
             cancelled_at = ?, updated_at = ?
         WHERE user_id = ?`,
      )
      .run(stamp, stamp, stamp, input.userId);
    recordProcessed(eventId, invoice.checkout_id, { invoiceId: invoice.id, kind: "refund" });
    db().exec("COMMIT");
  } catch (error) {
    try {
      db().exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }

  return {
    ok: true as const,
    duplicate: false,
    invoiceId: invoice.id,
    entitlement: getEntitlement(input.userId),
    message: "Terugbetaling verwerkt. Pro-rechten zijn beëindigd.",
  };
}
