import { db } from "@/lib/auth/db";

let ready = false;

export function ensureBillingSchema() {
  if (ready) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS analysis_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      period_key TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      idempotency_key TEXT,
      sport_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      place_label TEXT NOT NULL,
      period TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, cache_key),
      UNIQUE(user_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_user_period ON analysis_ledger(user_id, period_key);

    CREATE TABLE IF NOT EXISTS analysis_cache (
      cache_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_customers (
      user_id TEXT PRIMARY KEY,
      mollie_customer_id TEXT,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_checkouts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mollie_payment_id TEXT,
      mollie_customer_id TEXT,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      state TEXT NOT NULL,
      checkout_url TEXT,
      consent_at TEXT,
      idempotency_key TEXT UNIQUE,
      raw_status TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      state TEXT NOT NULL,
      mollie_subscription_id TEXT,
      mollie_customer_id TEXT,
      mollie_mandate_id TEXT,
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      checkout_id TEXT,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      issued_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_webhook_events (
      id TEXT PRIMARY KEY,
      provider_event_id TEXT UNIQUE,
      payment_id TEXT,
      processed_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
  `);
  ensureColumn("billing_subscriptions", "mollie_mandate_id", "TEXT");
  ready = true;
}

function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db()
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (!cols.some((col) => col.name === column)) {
    db().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}
