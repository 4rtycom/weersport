-- Phase 1 durable identity schema (Postgres)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  draft_json TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_mail (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  meta_json TEXT
);

CREATE TABLE IF NOT EXISTS planned_moments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  place_label TEXT NOT NULL,
  period TEXT NOT NULL,
  window_label TEXT NOT NULL,
  planned_start TIMESTAMPTZ NOT NULL,
  planned_end TIMESTAMPTZ NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  last_snapshot_at TIMESTAMPTZ,
  last_score_label TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  place_label TEXT NOT NULL,
  period TEXT NOT NULL,
  last_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS favorite_sports (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, sport_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weekend_focus INTEGER NOT NULL DEFAULT 1,
  uv_reminders INTEGER NOT NULL DEFAULT 1,
  save_plans_by_default INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS analysis_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  idempotency_key TEXT,
  sport_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  place_label TEXT NOT NULL,
  period TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, cache_key),
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_period ON analysis_ledger(user_id, period_key);

CREATE TABLE IF NOT EXISTS analysis_cache (
  cache_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_customers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mollie_customer_id TEXT,
  mode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_checkouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mollie_payment_id TEXT,
  mollie_customer_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  state TEXT NOT NULL,
  checkout_url TEXT,
  consent_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  raw_status TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  state TEXT NOT NULL,
  mollie_subscription_id TEXT,
  mollie_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkout_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT UNIQUE,
  payment_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL,
  payload_json TEXT NOT NULL
);
