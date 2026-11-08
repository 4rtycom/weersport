import { db } from "@/lib/auth/db";

let ready = false;

export function ensureCommercialSchema() {
  if (ready) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS sponsor_profiles (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      public_name TEXT NOT NULL,
      destination_url TEXT NOT NULL,
      logo_id TEXT,
      moderation_status TEXT NOT NULL,
      moderation_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sponsor_billing_profiles (
      id TEXT PRIMARY KEY,
      sponsor_id TEXT NOT NULL,
      legal_name TEXT NOT NULL,
      street TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      vat_id TEXT,
      invoice_email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sponsor_logos (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      body_base64 TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sponsor_quotes (
      id TEXT PRIMARY KEY,
      sport_ids TEXT NOT NULL,
      country TEXT NOT NULL,
      rate_version TEXT NOT NULL,
      rate_cents INTEGER NOT NULL,
      rate_mode TEXT NOT NULL,
      net_cents INTEGER NOT NULL,
      vat_cents INTEGER NOT NULL,
      gross_cents INTEGER NOT NULL,
      lines_json TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sponsor_contracts (
      id TEXT PRIMARY KEY,
      sponsor_id TEXT NOT NULL,
      quote_id TEXT NOT NULL,
      rate_version TEXT NOT NULL,
      rate_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      anchor_day INTEGER NOT NULL,
      contract_date TEXT NOT NULL,
      paid_until TEXT,
      consent_version TEXT NOT NULL,
      consent_at TEXT,
      cancel_effective_at TEXT,
      pending_sport_ids TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sponsor_contract_sports (
      contract_id TEXT NOT NULL,
      sport_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      PRIMARY KEY (contract_id, sport_id, period_start)
    );
    CREATE TABLE IF NOT EXISTS sponsor_checkouts (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL UNIQUE,
      quote_id TEXT NOT NULL,
      sponsor_id TEXT NOT NULL,
      contract_id TEXT,
      request_hash TEXT NOT NULL,
      mollie_customer_id TEXT,
      mollie_payment_id TEXT,
      mollie_mandate_id TEXT,
      kind TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      checkout_url TEXT NOT NULL,
      return_token TEXT NOT NULL UNIQUE,
      environment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sponsor_checkouts_payment
      ON sponsor_checkouts (mollie_payment_id);
    CREATE TABLE IF NOT EXISTS sponsor_invoice_periods (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      lines_json TEXT NOT NULL,
      net_cents INTEGER NOT NULL,
      vat_cents INTEGER NOT NULL,
      gross_cents INTEGER NOT NULL,
      recipient_json TEXT NOT NULL,
      seller_json TEXT NOT NULL,
      provider_invoice_id TEXT,
      invoice_number TEXT,
      status TEXT NOT NULL,
      email_status TEXT NOT NULL,
      payment_ref TEXT,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (contract_id, period_start)
    );
    CREATE TABLE IF NOT EXISTS sponsor_operations (
      id TEXT PRIMARY KEY,
      op_key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      lease_until TEXT,
      attempts INTEGER NOT NULL,
      next_attempt_at TEXT,
      last_error TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sponsor_provider_objects (
      provider_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      local_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      environment TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS affiliate_offers (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      destination_url TEXT NOT NULL,
      tracking_url TEXT NOT NULL,
      category TEXT NOT NULL,
      sport_ids TEXT NOT NULL,
      status TEXT NOT NULL,
      stock TEXT,
      valid_from TEXT,
      valid_until TEXT,
      feed_at TEXT NOT NULL,
      generation TEXT NOT NULL,
      test_data INTEGER NOT NULL,
      excluded INTEGER NOT NULL DEFAULT 0,
      UNIQUE (provider, external_id)
    );
    CREATE TABLE IF NOT EXISTS affiliate_generations (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      item_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      published_at TEXT,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS affiliate_rules (
      id TEXT PRIMARY KEY,
      sport_id TEXT NOT NULL,
      category TEXT NOT NULL,
      condition_json TEXT NOT NULL,
      priority INTEGER NOT NULL,
      specific INTEGER NOT NULL,
      enabled INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS affiliate_daily (
      sport_id TEXT NOT NULL,
      offer_id TEXT NOT NULL,
      day TEXT NOT NULL,
      impressions INTEGER NOT NULL,
      clicks INTEGER NOT NULL,
      PRIMARY KEY (sport_id, offer_id, day)
    );
    CREATE TABLE IF NOT EXISTS affiliate_events (
      placement_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (placement_id, kind)
    );
    CREATE TABLE IF NOT EXISTS affiliate_conversions (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      offer_id TEXT NOT NULL,
      status TEXT NOT NULL,
      commission_cents INTEGER,
      UNIQUE (provider, transaction_id)
    );
    CREATE TABLE IF NOT EXISTS sponsor_audit (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      subject TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sponsor_manage_tokens (
      token_hash TEXT PRIMARY KEY,
      sponsor_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
  ready = true;
}

export function resetCommercialSchemaForTests() {
  ready = false;
}
