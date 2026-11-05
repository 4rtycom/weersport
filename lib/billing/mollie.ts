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
import { addDaysIso } from "@/lib/billing/period";
import { ensureBillingSchema } from "@/lib/billing/schema";

export type CheckoutSession = {
  id: string;
  state: BillingState;
  checkoutUrl: string;
  amount: string;
  currency: string;
  mode: "live-api" | "sandbox-local";
  disclosure: string;
};

function nowIso() {
  return new Date().toISOString();
}

function apiKey() {
  return process.env.MOLLIE_API_KEY?.trim() || "";
}

export function mollieMode(): "live-api" | "sandbox-local" {
  return apiKey() ? "live-api" : "sandbox-local";
}

async function mollieFetch(path: string, init?: RequestInit) {
  const key = apiKey();
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
  if (!input.consent) {
    return { ok: false, status: 400, error: "Bevestig akkoord voor doorlopende Pro-betaling via Mollie." };
  }
  if (isProActive(input.userId)) {
    return { ok: false, status: 409, error: "Je hebt al een actieve Pro-periode." };
  }

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
          mode: mollieMode(),
          disclosure: BILLING_DISCLOSURE,
        },
      };
    }
  }

  const checkoutId = randomUUID();
  const stamp = nowIso();
  const mode = mollieMode();
  let mollieCustomerId: string | null = getCustomer(input.userId)?.mollie_customer_id ?? null;
  let molliePaymentId: string | null = null;
  let checkoutUrl = `${input.origin}/checkout/betaal-simulatie?checkout=${checkoutId}`;
  let state: BillingState = "checkout_created";

  if (mode === "live-api") {
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
    const links = payment._links as { checkout?: { href?: string } } | undefined;
    checkoutUrl = links?.checkout?.href ?? checkoutUrl;
    state = "payment_pending";
  } else {
    upsertCustomer(input.userId, `cst_local_${input.userId.slice(0, 8)}`, mode);
    mollieCustomerId = `cst_local_${input.userId.slice(0, 8)}`;
    molliePaymentId = `tr_local_${checkoutId.slice(0, 12)}`;
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

function writeInvoice(userId: string, checkoutId: string, status: string) {
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
      "WeerSport Pro · maandabonnement",
      nowIso(),
    );
  return id;
}

function activatePro(userId: string, customerId: string | null, checkoutId: string) {
  const stamp = nowIso();
  const periodEnd = addDaysIso(30);
  db()
    .prepare(
      `INSERT INTO billing_subscriptions (
        user_id, plan, state, mollie_subscription_id, mollie_customer_id,
        current_period_start, current_period_end, cancel_at_period_end, cancelled_at, updated_at, created_at
      ) VALUES (?, 'pro', 'subscription_active', ?, ?, ?, ?, 0, NULL, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        plan = 'pro',
        state = 'subscription_active',
        mollie_subscription_id = excluded.mollie_subscription_id,
        mollie_customer_id = excluded.mollie_customer_id,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = 0,
        cancelled_at = NULL,
        updated_at = excluded.updated_at`,
    )
    .run(userId, `sub_${checkoutId.slice(0, 12)}`, customerId, stamp, periodEnd, stamp, stamp);
  db()
    .prepare("UPDATE billing_checkouts SET state = ?, raw_status = ?, updated_at = ? WHERE id = ?")
    .run("payment_paid", "paid", stamp, checkoutId);
  writeInvoice(userId, checkoutId, "paid");
}

function failCheckout(checkoutId: string, raw: string) {
  db()
    .prepare("UPDATE billing_checkouts SET state = ?, raw_status = ?, updated_at = ? WHERE id = ?")
    .run("payment_failed", raw, nowIso(), checkoutId);
}

/**
 * Verify provider payment status server-side, then apply entitlement changes idempotently.
 * Browser redirects must call this path indirectly; they never activate Pro alone.
 */
export async function verifyAndApplyPayment(input: {
  checkoutId: string;
  expectedUserId?: string;
  simulatedStatus?: "paid" | "failed" | "canceled" | "pending";
  providerEventId?: string;
}) {
  ensureBillingSchema();
  const checkout = getCheckout(input.checkoutId);
  if (!checkout) return { ok: false as const, status: 404, error: "Checkout niet gevonden." };
  if (input.expectedUserId && checkout.user_id !== input.expectedUserId) {
    return { ok: false as const, status: 403, error: "Checkout hoort niet bij dit account." };
  }

  if (input.providerEventId) {
    const seen = db()
      .prepare("SELECT id FROM billing_webhook_events WHERE provider_event_id = ?")
      .get(input.providerEventId) as { id: string } | undefined;
    if (seen) {
      return {
        ok: true as const,
        state: checkout.state,
        entitlement: getEntitlement(checkout.user_id),
        duplicate: true,
      };
    }
  }

  let providerStatus: string = input.simulatedStatus ?? "pending";
  if (mollieMode() === "live-api" && checkout.mollie_payment_id) {
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
  }

  if (input.providerEventId) {
    db()
      .prepare(
        `INSERT INTO billing_webhook_events (id, provider_event_id, payment_id, processed_at, payload_json)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.providerEventId,
        checkout.mollie_payment_id,
        nowIso(),
        JSON.stringify({ checkoutId: checkout.id, providerStatus }),
      );
  }

  if (providerStatus === "paid") {
    if (checkout.state !== "payment_paid" && !isProActive(checkout.user_id)) {
      activatePro(checkout.user_id, checkout.mollie_customer_id, checkout.id);
    }
    return {
      ok: true as const,
      state: "payment_paid",
      entitlement: getEntitlement(checkout.user_id),
      duplicate: false,
    };
  }

  if (providerStatus === "failed" || providerStatus === "canceled" || providerStatus === "expired") {
    failCheckout(checkout.id, providerStatus);
    return {
      ok: true as const,
      state: providerStatus === "canceled" ? "cancelled" : "payment_failed",
      entitlement: getEntitlement(checkout.user_id),
      duplicate: false,
    };
  }

  db()
    .prepare("UPDATE billing_checkouts SET state = ?, raw_status = ?, updated_at = ? WHERE id = ?")
    .run("payment_pending", providerStatus, nowIso(), checkout.id);
  return {
    ok: true as const,
    state: "payment_pending",
    entitlement: getEntitlement(checkout.user_id),
    duplicate: false,
  };
}

export function requestCancel(userId: string) {
  ensureBillingSchema();
  const row = db()
    .prepare("SELECT * FROM billing_subscriptions WHERE user_id = ?")
    .get(userId) as
    | {
        plan: string;
        state: string;
        current_period_end: string | null;
      }
    | undefined;
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
      "Opzegging ontvangen. Pro blijft actief tot het einde van de betaalde periode; er volgt geen automatische verlenging in deze fase.",
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
